define(["playbackManager","events","serverNotifications","connectionManager"],function(playbackManager,events,serverNotifications,connectionManager){"use strict";function getActivePlayerId(){var info=playbackManager.getPlayerInfo();return info?info.id:null}function sendPlayCommand(apiClient,options,playType){var sessionId=getActivePlayerId(),ids=options.ids||options.items.map(function(i){return i.Id}),remoteOptions={ItemIds:ids.join(","),PlayCommand:playType};return options.startPositionTicks&&(remoteOptions.StartPositionTicks=options.startPositionTicks),options.mediaSourceId&&(remoteOptions.MediaSourceId=options.mediaSourceId),null!=options.audioStreamIndex&&(remoteOptions.AudioStreamIndex=options.audioStreamIndex),null!=options.subtitleStreamIndex&&(remoteOptions.SubtitleStreamIndex=options.subtitleStreamIndex),apiClient.sendPlayCommand(sessionId,remoteOptions)}function sendPlayStateCommand(apiClient,command,options){var sessionId=getActivePlayerId();apiClient.sendPlayStateCommand(sessionId,command,options)}function getCurrentApiClient(instance){var currentServerId=instance.currentServerId;return currentServerId?connectionManager.getApiClient(currentServerId):connectionManager.currentApiClient()}function sendCommandByName(instance,name,options){var command={Name:name};options&&(command.Arguments=options),instance.sendCommand(command)}function unsubscribeFromPlayerUpdates(instance){instance.isUpdating=!0;var apiClient=getCurrentApiClient(instance);apiClient.isWebSocketOpen()&&apiClient.sendWebSocketMessage("SessionsStop"),instance.pollInterval&&(clearInterval(instance.pollInterval),instance.pollInterval=null)}function processUpdatedSessions(instance,sessions,apiClient){var serverId=apiClient.serverId();sessions.map(function(s){s.NowPlayingItem&&(s.NowPlayingItem.ServerId=serverId)});var currentTargetId=getActivePlayerId(),session=sessions.filter(function(s){return s.Id===currentTargetId})[0],state=getPlayerState(session);normalizeImages(state,apiClient),instance.lastPlayerData=state,session&&(firePlaybackEvent(instance,"statechange",session,apiClient),firePlaybackEvent(instance,"timeupdate",session,apiClient),firePlaybackEvent(instance,"pause",session,apiClient))}function onPollIntervalFired(){var instance=this,apiClient=getCurrentApiClient(instance);apiClient.isWebSocketOpen()||apiClient.getSessions().then(function(sessions){processUpdatedSessions(instance,sessions,apiClient)})}function subscribeToPlayerUpdates(instance){instance.isUpdating=!0;var apiClient=getCurrentApiClient(instance);apiClient.isWebSocketOpen()&&apiClient.sendWebSocketMessage("SessionsStart","100,800"),instance.pollInterval&&(clearInterval(instance.pollInterval),instance.pollInterval=null),instance.pollInterval=setInterval(onPollIntervalFired.bind(instance),5e3)}function getPlayerState(session){return session}function normalizeImages(state,apiClient){if(state&&state.NowPlayingItem){var item=state.NowPlayingItem;item.ImageTags&&item.ImageTags.Primary||item.PrimaryImageTag&&(item.ImageTags=item.ImageTags||{},item.ImageTags.Primary=item.PrimaryImageTag),item.BackdropImageTag&&item.BackdropItemId===item.Id&&(item.BackdropImageTags=[item.BackdropImageTag]),item.BackdropImageTag&&item.BackdropItemId!==item.Id&&(item.ParentBackdropImageTags=[item.BackdropImageTag],item.ParentBackdropItemId=item.BackdropItemId),item.ServerId||(item.ServerId=apiClient.serverId())}}function firePlaybackEvent(instance,name,session,apiClient){var state=getPlayerState(session);normalizeImages(state,apiClient),instance.lastPlayerData=state,events.trigger(instance,name,[state])}function SessionPlayer(){var self=this;this.name="Remote Control",this.type="mediaplayer",this.isLocalPlayer=!1,this.id="remoteplayer",events.on(serverNotifications,"Sessions",function(e,apiClient,data){processUpdatedSessions(self,data,apiClient)}),events.on(serverNotifications,"SessionEnded",function(e,apiClient,data){console.log("Server reports another session ended"),getActivePlayerId()===data.Id&&playbackManager.setDefaultPlayerActive()}),events.on(serverNotifications,"PlaybackStart",function(e,apiClient,data){data.DeviceId!==apiClient.deviceId()&&getActivePlayerId()===data.Id&&firePlaybackEvent(self,"playbackstart",data,apiClient)}),events.on(serverNotifications,"PlaybackStopped",function(e,apiClient,data){data.DeviceId!==apiClient.deviceId()&&getActivePlayerId()===data.Id&&firePlaybackEvent(self,"playbackstop",data,apiClient)})}return SessionPlayer.prototype.beginPlayerUpdates=function(){this.playerListenerCount=this.playerListenerCount||0,this.playerListenerCount<=0&&(this.playerListenerCount=0,subscribeToPlayerUpdates(this)),this.playerListenerCount++},SessionPlayer.prototype.endPlayerUpdates=function(){this.playerListenerCount=this.playerListenerCount||0,this.playerListenerCount--,this.playerListenerCount<=0&&(unsubscribeFromPlayerUpdates(this),this.playerListenerCount=0)},SessionPlayer.prototype.getPlayerState=function(){return this.lastPlayerData||{}},SessionPlayer.prototype.getTargets=function(){var apiClient=getCurrentApiClient(this),sessionQuery={ControllableByUserId:apiClient.getCurrentUserId()};if(apiClient){var name=this.name;return apiClient.getSessions(sessionQuery).then(function(sessions){return sessions.filter(function(s){return s.DeviceId!==apiClient.deviceId()}).map(function(s){return{name:s.DeviceName,deviceName:s.DeviceName,id:s.Id,playerName:name,appName:s.Client,playableMediaTypes:s.PlayableMediaTypes,isLocalPlayer:!1,supportedCommands:s.SupportedCommands}})})}return Promise.resolve([])},SessionPlayer.prototype.sendCommand=function(command){var sessionId=getActivePlayerId(),apiClient=getCurrentApiClient(this);apiClient.sendCommand(sessionId,command)},SessionPlayer.prototype.play=function(options){return options=Object.assign({},options),options.items&&(options.ids=options.items.map(function(i){return i.Id}),options.items=null),sendPlayCommand(getCurrentApiClient(this),options,"PlayNow")},SessionPlayer.prototype.shuffle=function(item){sendPlayCommand(getCurrentApiClient(this),{ids:[item.Id]},"PlayShuffle")},SessionPlayer.prototype.instantMix=function(item){sendPlayCommand(getCurrentApiClient(this),{ids:[item.Id]},"PlayInstantMix")},SessionPlayer.prototype.queue=function(options){sendPlayCommand(getCurrentApiClient(this),options,"PlayNext")},SessionPlayer.prototype.queueNext=function(options){sendPlayCommand(getCurrentApiClient(this),options,"PlayLast")},SessionPlayer.prototype.canPlayMediaType=function(mediaType){return mediaType=(mediaType||"").toLowerCase(),"audio"===mediaType||"video"===mediaType},SessionPlayer.prototype.canQueueMediaType=function(mediaType){return this.canPlayMediaType(mediaType)},SessionPlayer.prototype.stop=function(){sendPlayStateCommand(getCurrentApiClient(this),"stop")},SessionPlayer.prototype.nextTrack=function(){sendPlayStateCommand(getCurrentApiClient(this),"nextTrack")},SessionPlayer.prototype.previousTrack=function(){sendPlayStateCommand(getCurrentApiClient(this),"previousTrack")},SessionPlayer.prototype.seek=function(positionTicks){sendPlayStateCommand(getCurrentApiClient(this),"seek",{SeekPositionTicks:positionTicks})},SessionPlayer.prototype.currentTime=function(val){if(null!=val)return this.seek(val);var state=this.lastPlayerData||{};return state=state.PlayState||{},state.PositionTicks},SessionPlayer.prototype.duration=function(){var state=this.lastPlayerData||{};return state=state.NowPlayingItem||{},state.RunTimeTicks},SessionPlayer.prototype.paused=function(){var state=this.lastPlayerData||{};return state=state.PlayState||{},state.IsPaused},SessionPlayer.prototype.getVolume=function(){var state=this.lastPlayerData||{};return state=state.PlayState||{},state.VolumeLevel},SessionPlayer.prototype.pause=function(){sendPlayStateCommand(getCurrentApiClient(this),"Pause")},SessionPlayer.prototype.unpause=function(){sendPlayStateCommand(getCurrentApiClient(this),"Unpause")},SessionPlayer.prototype.playPause=function(){sendPlayStateCommand(getCurrentApiClient(this),"PlayPause")},SessionPlayer.prototype.setMute=function(isMuted){isMuted?sendCommandByName(this,"Mute"):sendCommandByName(this,"Unmute")},SessionPlayer.prototype.toggleMute=function(){sendCommandByName(this,"ToggleMute")},SessionPlayer.prototype.setVolume=function(vol){sendCommandByName(this,"SetVolume",{Volume:vol})},SessionPlayer.prototype.volumeUp=function(){sendCommandByName(this,"VolumeUp")},SessionPlayer.prototype.volumeDown=function(){sendCommandByName(this,"VolumeDown")},SessionPlayer.prototype.toggleFullscreen=function(){sendCommandByName(this,"ToggleFullscreen")},SessionPlayer.prototype.audioTracks=function(){var state=this.lastPlayerData||{};state=state.NowPlayingItem||{};var streams=state.MediaStreams||[];return streams.filter(function(s){return"Audio"===s.Type})},SessionPlayer.prototype.getAudioStreamIndex=function(){var state=this.lastPlayerData||{};return state=state.PlayState||{},state.AudioStreamIndex},SessionPlayer.prototype.setAudioStreamIndex=function(index){sendCommandByName(this,"SetAudioStreamIndex",{Index:index})},SessionPlayer.prototype.subtitleTracks=function(){var state=this.lastPlayerData||{};state=state.NowPlayingItem||{};var streams=state.MediaStreams||[];return streams.filter(function(s){return"Subtitle"===s.Type})},SessionPlayer.prototype.getSubtitleStreamIndex=function(){var state=this.lastPlayerData||{};return state=state.PlayState||{},state.SubtitleStreamIndex},SessionPlayer.prototype.setSubtitleStreamIndex=function(index){sendCommandByName(this,"SetSubtitleStreamIndex",{Index:index})},SessionPlayer.prototype.getMaxStreamingBitrate=function(){},SessionPlayer.prototype.setMaxStreamingBitrate=function(options){},SessionPlayer.prototype.isFullscreen=function(){},SessionPlayer.prototype.toggleFullscreen=function(){},SessionPlayer.prototype.getRepeatMode=function(){},SessionPlayer.prototype.setRepeatMode=function(mode){sendCommandByName(this,"SetRepeatMode",{RepeatMode:mode})},SessionPlayer.prototype.displayContent=function(options){sendCommandByName(this,"DisplayContent",options)},SessionPlayer.prototype.isPlaying=function(){var state=this.lastPlayerData||{};return null!=state.NowPlayingItem},SessionPlayer.prototype.isPlayingVideo=function(){var state=this.lastPlayerData||{};return state=state.NowPlayingItem||{},"Video"===state.MediaType},SessionPlayer.prototype.isPlayingAudio=function(){var state=this.lastPlayerData||{};return state=state.NowPlayingItem||{},"Audio"===state.MediaType},SessionPlayer.prototype.getPlaylist=function(){return Promise.resolve([])},SessionPlayer.prototype.getCurrentPlaylistItemId=function(){},SessionPlayer.prototype.setCurrentPlaylistItem=function(playlistItemId){return Promise.resolve()},SessionPlayer.prototype.removeFromPlaylist=function(playlistItemIds){return Promise.resolve()},SessionPlayer.prototype.tryPair=function(target){return Promise.resolve()},SessionPlayer});