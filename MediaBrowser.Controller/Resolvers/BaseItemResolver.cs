﻿using System;
using System.IO;
using System.Threading.Tasks;
using MediaBrowser.Controller.Events;
using MediaBrowser.Model.Entities;
using MediaBrowser.Controller.IO;
using System.Collections.Generic;

namespace MediaBrowser.Controller.Resolvers
{
    public abstract class BaseItemResolver<T> : IBaseItemResolver
        where T : BaseItem, new()
    {
        protected virtual T Resolve(ItemResolveEventArgs args)
        {
            return null;
        }

        public virtual ResolverPriority Priority
        {
            get
            {
                return ResolverPriority.First;
            }
        }

        /// <summary>
        /// Sets initial values on the newly resolved item
        /// </summary>
        protected virtual void SetInitialItemValues(T item, ItemResolveEventArgs args)
        {
            // If the subclass didn't specify this
            if (string.IsNullOrEmpty(item.Path))
            {
                item.Path = args.Path;
            }

            // If the subclass didn't specify this
            if (args.Parent != null)
            {
                item.Parent = args.Parent;
            }

            item.Id = Kernel.GetMD5(item.Path);
        }

        public BaseItem ResolvePath(ItemResolveEventArgs args)
        {
            T item = Resolve(args);

            if (item != null)
            {
                // Set initial values on the newly resolved item
                SetInitialItemValues(item, args);

                // Make sure the item has a name
                EnsureName(item);

                // Make sure DateCreated and DateModified have values
                EnsureDates(item, args);
            }

            return item;
        }

        private void EnsureName(T item)
        {
            // If the subclass didn't supply a name, add it here
            if (string.IsNullOrEmpty(item.Name))
            {
                item.Name = Path.GetFileNameWithoutExtension(item.Path);
            }

        }

        /// <summary>
        /// Ensures DateCreated and DateModified have values
        /// </summary>
        private void EnsureDates(T item, ItemResolveEventArgs args)
        {
            if (!Path.IsPathRooted(item.Path))
            {
                return;
            }

            WIN32_FIND_DATA fileData = args.FileData;

            // See if a different path came out of the resolver than what went in
            if (!args.Path.Equals(item.Path, StringComparison.OrdinalIgnoreCase))
            {
                KeyValuePair<string, WIN32_FIND_DATA>? childData = args.GetFileSystemEntry(item.Path, null);

                if (childData != null)
                {
                    fileData = childData.Value.Value;
                }
                else
                {
                    fileData = FileData.GetFileData(item.Path);
                }
            }

            item.DateCreated = fileData.CreationTime;

            item.DateModified = fileData.LastWriteTime;
        }
    }

    /// <summary>
    /// Weed this to keep a list of resolvers, since Resolvers are built with generics
    /// </summary>
    public interface IBaseItemResolver
    {
        BaseItem ResolvePath(ItemResolveEventArgs args);
        ResolverPriority Priority { get; }
    }

    public enum ResolverPriority
    {
        First,
        Second,
        Third,
        Last
    }
}
