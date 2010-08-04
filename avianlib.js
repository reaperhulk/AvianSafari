/*
AvianLib: Javascript OAuth for Twitter
Primarily designed for Twitter, this is an OAuth lib written entirely in Javascript (for use in JS environments not bound by cross-domain restrictions.  Appcelerator, WebOS, Safari extensions, Chrome extensions, et cetera). Avian itself is specific to Twitter, but the OAuth object (found in avianlib_oauth.js) should be easily used for different OAuth applications.

    Copyright 2010 Paul Kehrer

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

function Avian(params) {
	params = params || {};
	this.OAuth = params.OAuth;
	this.log_to_console = params.log_to_console || false;
	if(typeof params.responses == 'object' && params.responses != null) {
		this.responses = params.responses;
	} else {
		this.responses = {};
	}
	if(typeof params.metadata == 'object' && params.metadata != null) {
		this.metadata = params.metadata;
	} else {
		this.metadata = { tweets: {}, direct_messages: {} };
	}
	//be careful that you provide these params as int and not string
	this.unreadTweets = (params.unreadTweets)?params.unreadTweets:0;
	this.unreadMentions = (params.unreadMentions)?params.unreadMentions:0;
	this.unreadDMs = (params.unreadDMs)?params.unreadDMs:0;
	this.maxTweetsStored = 10000; //configurable. how many do you want to keep around?
	this.defaultNumTweetsRequested = 100; //default number to obtain for methods like getHomeTimeline

	//for PATHS we track with a boolean whether auth is required, but we don't do anything with it
	this.PATHS = {
		'request_token': {
			url:	'https://api.twitter.com/oauth/request_token',
			method: 'GET',
			concat: false,
			auth: true
		},
		'access_token': {
			url:	'https://api.twitter.com/oauth/access_token',
			method: 'GET',
			concat: false,
			auth: true
		},
		'home_timeline': {
			url:	'https://api.twitter.com/1/statuses/home_timeline.json',
			method: 'GET',
			concat: false,
			auth: true
		},
		'mentions': {
			url:	'https://api.twitter.com/1/statuses/mentions.json',
			method: 'GET',
			concat: false,
			auth: true
		},
		'update': {
			url:	'https://api.twitter.com/1/statuses/update.json',
			method: 'POST',
			concat: false,
			auth: true
		},
		'retweet': {
			url:	'https://api.twitter.com/1/statuses/retweet/',
			method: 'POST',
			concat: true,
			auth: true
		},
		'show': {
			url:	'https://api.twitter.com/1/statuses/show/',
			method: 'GET',
			concat: true,
			auth: true
		},
		'direct_messages': {
			url:	'https://api.twitter.com/1/direct_messages.json',
			method: 'GET',
			concat: false,
			auth: true
		},
		'dm_sent': {
			url:	'https://api.twitter.com/1/direct_messages/sent.json',
			method: 'GET',
			concat: false,
			auth: true
		},
		'dm_new': {
			url:	'https://api.twitter.com/1/direct_messages/new.json',
			method: 'POST',
			concat: false,
			auth: true
		},
		'dm_destroy': {
			url:	'https://api.twitter.com/1/direct_messages/destroy/',
			method: 'POST',
			concat: true,
			auth: true
		},
		'friendships_create': {
			url:	'https://api.twitter.com/1/friendships/create/',
			method: 'POST',
			concat: true,
			auth: true
		},
		'friendships_destroy': {
			url:	'https://api.twitter.com/1/friendships/destroy/',
			method: 'POST',
			concat: true,
			auth: true
		},
		//trends doesn't require auth...we send it anyway for now
		'trends': {
			url:	'https://search.twitter.com/trends.json',
			method: 'GET',
			concat: false,
			auth: false
		},
		'favorites': {
			url:	'https://api.twitter.com/1/favorites.json',
			method: 'GET',
			concat: false,
			auth: true
		},
		'favorites_create': {
			url:	'https://api.twitter.com/1/favorites/create/',
			method: 'POST',
			concat: true,
			auth: true
		},
		'favorites_destroy': {
			url:	'https://api.twitter.com/1/favorites/destroy/',
			method: 'POST',
			concat: true,
			auth: true
		},
		'nearby_places': {
			url:	'https://api.twitter.com/1/geo/nearby_places.json',
			method: 'GET',
			concat: false,
			auth: false
		}
	};
}


Avian.prototype = {
	getRequestToken: function(userSuccessCallback,userErrorCallback) {
		//if present, we don't want them since their signature will mess up a new auth request
		delete this.OAuth.oauth_token;
		delete this.OAuth.oauth_token_secret;
		var info = this.getPath('request_token');
		this.OAuth.getToken(info.url,info.method,{},userSuccessCallback,userErrorCallback);
	},

	getAccessToken: function(userSuccessCallback,userErrorCallback) {
		var info = this.getPath('access_token');
		this.OAuth.getToken(info.url,info.method,{},userSuccessCallback,userErrorCallback);
	},

	queryTwitter : function(apiMethod,params,userSuccessCallback,userErrorCallback) {
		this.logging('queryTwitter params:');
		this.logging(params);
		var self = this;
		var successCallback = function(data, textStatus, xhr) {
			//self.logging('success callback response: '+data);
			var parsedObj;
			try {
				parsedObj = JSON.parse(data);
			} catch(e) {
				parsedObj = eval(data); //boo eval.
			}
			self.logging(parsedObj);
			if(typeof self.responses[apiMethod] == 'object' && self.responses[apiMethod] instanceof Array === true) {
				self.responses[apiMethod] = parsedObj.concat(self.responses[apiMethod]);
			} else {
				self.responses[apiMethod] = parsedObj;
			}
			if(typeof userSuccessCallback == 'function') { userSuccessCallback(parsedObj); }
		};
		var errorCallback = function(xhr, textStatus, errorThrown) {
			//should probably handle the common twitter errors here
			//http://apiwiki.twitter.com/HTTP-Response-Codes-and-Errors
			self.logging('queryTwitter error callback response: '+errorThrown);
			if(typeof userErrorCallback == 'function') { userErrorCallback(errorThrown); }
		};
		var info = this.getPath(apiMethod);

		var url = info.url;
		if(info.concat) {
			//this is an ugly hack. tries to guess whether we want to fetch via user_id or status_id (usually the latter)
			//TODO, better method (this is method #2, but maybe 3rd time's the charm)
			var id = (typeof params.status_id != 'undefined')?params.status_id:params.user_id;
			//build proper URL
			url = info.url+id+'.json';
			if(typeof params.status_id != 'undefined') {
				delete params.status_id;
			} else if (typeof params.user_id != 'undefined') {
				delete params.status_id;
			}
		}
		this.logging(url);
		this.OAuth.request(url,info.method,params,successCallback,errorCallback);
	},

	getPath : function(apiMethod) {
		return this.PATHS[apiMethod];
	},
	
	addTweetMetadata: function(obj) {
		this.logging('adding tweet metadata');
		for(var i=0;i < obj.length;i++) {
			var tweet = obj[i];
			if(typeof this.metadata.tweets[tweet.id] == 'undefined') {
				this.metadata.tweets[tweet.id] = {unread:true};
			}
		}
	},
	
	addDirectMessageMetadata: function(obj,sentReceived) {
		this.logging('adding DM metadata');
		for(var i=0;i < obj.length;i++) {
			var dm = obj[i];
			if(typeof this.metadata.direct_messages[dm.id] == 'undefined') {
				if(sentReceived == 'received') {
					this.metadata.direct_messages[dm.id] = {unread:true};
				} else {
					//the user sent this so we don't want it to be unread...
					this.metadata.direct_messages[dm.id] = {unread:false};
				}
			}
		}
	},

	//gets the home_timeline. 
	getHomeTimeline : function(params,userSuccessCallback,userErrorCallback) {
		//by default, get only the latest tweets
		if(typeof this.responses.home_timeline != 'undefined' && typeof this.responses.home_timeline[0] != 'undefined' && typeof params.since_id == 'undefined') {
			params.since_id = this.responses.home_timeline[0].id;
		}
		if(typeof params.count == 'undefined') {
			params.count = this.defaultNumTweetsRequested;
		}
		if(typeof params.include_entities == 'undefined') {
			params.include_entities = 1;
		}
		var self = this;
		function homeTimelineSuccessCallback(parsedObj) {
			//loop through the tweets, adding metadata for each one
			self.addTweetMetadata(parsedObj);
			//iterate over the metadata to see if all these new tweets have been read previously (perhaps as a mention)
			var newUnreadTweets = 0;
			for(var i=0;i < parsedObj.length;i++) {
				if(self.metadata.tweets[parsedObj[i].id].unread == true) {
					newUnreadTweets++;
				}
			}
			self.unreadTweets += newUnreadTweets;

			var numToRemove = self.responses['home_timeline'].length - self.maxTweetsStored;
			if (numToRemove > 0) {
				var index = self.responses['home_timeline'].length-numToRemove-1; //0 indexed so we need to subtract 1 more
				var removedTweets = self.responses['home_timeline'].splice(index,numToRemove);
			
				/*for(var j=0;j< removedTweets.length;j++) {
					var id = removedTweets[j].id;
					delete self.metadata.tweets[id]; //delete our metadata object for this tweet
				}*/
			}
			
			if(typeof userSuccessCallback == 'function') { userSuccessCallback(parsedObj); }
		}
		this.queryTwitter('home_timeline',params,homeTimelineSuccessCallback,userErrorCallback);
	},
	
	getMentions : function(params,userSuccessCallback,userErrorCallback) {
		//by default, get only the most recent mentions
		if(typeof this.responses.mentions != 'undefined' &&typeof this.responses.mentions[0] != 'undefined' && typeof params.since_id == 'undefined') {
			params.since_id = this.responses.mentions[0].id;
		}
		if(typeof params.count == 'undefined') {
			params.count = this.defaultNumTweetsRequested;
		}
		if(typeof params.include_entities == 'undefined') {
			params.include_entities = 1;
		}
		var self = this;
		function mentionsSuccessCallback(parsedObj) {
			self.addTweetMetadata(parsedObj);
			//iterate over the metadata to see if all these new tweets have been read previously (perhaps in home timeline)
			var newUnreadMentions = 0;
			for(var i=0;i < parsedObj.length;i++) {
				if(self.metadata.tweets[parsedObj[i].id].unread == true) {
					newUnreadMentions++;
				}
			}
			self.unreadMentions += newUnreadMentions;
			
			//see if the response array exceeds our allowed limit.
			//if so, truncate and strip the metadata out
			var numToRemove = self.responses['mentions'].length - self.maxTweetsStored;
			if (numToRemove > 0) {
				var index = self.responses['mentions'].length-numToRemove-1; //0 indexed so we need to subtract 1 more
				var removedTweets = self.responses['mentions'].splice(index,numToRemove);
			}
			
			if(typeof userSuccessCallback == 'function') { userSuccessCallback(parsedObj); }
		}
		this.queryTwitter('mentions',params,mentionsSuccessCallback,userErrorCallback);
	},
	
	getTweet: function(status_id,userSuccessCallback,userErrorCallback) {
		var found = false;
		if(typeof this.responses.home_timeline != 'undefined') {
			for(var i=0;i < this.responses.home_timeline.length;i++) {
				if(this.responses.home_timeline[i].id == status_id) {
					//okay we've already got the tweet. set the response object
					//and call their success callback
					this.responses.show = this.responses.home_timeline[i];
					if(typeof userSuccessCallback == 'function') { userSuccessCallback(this.responses.home_timeline[i]); }
					found = true;
					break;
				}
			}
		}
		if(typeof this.responses.mentions != 'undefined' && found != true) {
			for(var j=0;j < this.responses.mentions.length;j++) {
				if(this.responses.mentions[j].id == status_id) {
					//okay we've already got the tweet. set the response object
					//and call their success callback
					this.responses.show = this.responses.mentions[j];
					if(typeof userSuccessCallback == 'function') { userSuccessCallback(this.responses.mentions[j]); }
					found = true;
					break;
				}
			}
		}
		if(!found) {
			this.queryTwitter('show',{status_id:status_id},userSuccessCallback,userErrorCallback);
		}
	},
	
	getThread: function(status_id,userSuccessCallback,userErrorCallback) {
		this.responses.thread = [];
		var self = this;
		function successCallback(data) {
			if(data.in_reply_to_status_id == null) {
				self.responses.thread.push(data);
				if(typeof userSuccessCallback == 'function') { userSuccessCallback(self.responses.thread); }
			} else {
				self.responses.thread.push(data);
				self.getTweet(data.in_reply_to_status_id,successCallback,errorCallback);
			}
		}
		function errorCallback(errorThrown) {
			self.logging('getThread failed on xhr');
			if(typeof userErrorCallback == 'function') { userErrorCallback(errorThrown,self.responses.thread); }
		}
		this.getTweet(status_id,successCallback,errorCallback);
	},

	replyToTweet: function(params,userSuccessCallback,userErrorCallback) {
		this.queryTwitter('update',params,userSuccessCallback,userErrorCallback);
	},

	retweet: function(status_id,userSuccessCallback,userErrorCallback) {
		this.queryTwitter('retweet',{status_id:status_id},userSuccessCallback,userErrorCallback);
	},
	
	getDirectMessages: function(sentReceived,params,userSuccessCallback,userErrorCallback) {
		var apiMethod;
		if(sentReceived == 'received') {
			apiMethod = 'direct_messages';
		} else {
			apiMethod = 'dm_sent';
		}
		//by default, get only the most recent
		if(typeof this.responses[apiMethod] != 'undefined' && typeof params.since_id == 'undefined') {
			params.since_id = this.responses[apiMethod][0].id;
		}
		if(typeof params.count == 'undefined') {
			params.count = this.defaultNumTweetsRequested;
		}
		var self = this;
		function directMessagesSuccessCallback(parsedObj) {
			self.addDirectMessageMetadata(parsedObj,sentReceived);
			
			//iterate over the metadata to see if all these new DMs have been read previously
			var newUnreadDMs = 0;
			for(var i=0;i < parsedObj.length;i++) {
				if(self.metadata.direct_messages[parsedObj[i].id].unread == true) {
					newUnreadDMs++;
				}
			}
			self.unreadDMs += newUnreadDMs;
			
			//see if the response array exceeds our allowed limit.
			var numToRemove = self.responses[apiMethod].length - self.maxTweetsStored;
			if (numToRemove > 0) {
				var index = self.responses[apiMethod].length-numToRemove-1; //0 indexed so we need to subtract 1 more
				var removedDirectMessages = self.responses[apiMethod].splice(index,numToRemove);
			}
			
			if(typeof userSuccessCallback == 'function') { userSuccessCallback(parsedObj); }
		}
		this.queryTwitter(apiMethod,params,directMessagesSuccessCallback,userErrorCallback);
	},
	
	getReceivedDirectMessages: function(params,userSuccessCallback,userErrorCallback) {
		this.getDirectMessages('received',params,userSuccessCallback,userErrorCallback);
	},

	getSentDirectMessages: function(params,userSuccessCallback,userErrorCallback) {
		this.getDirectMessages('sent',params,userSuccessCallback,userErrorCallback);
	},

	sendDirectMessage: function(status,user_id,userSuccessCallback,userErrorCallback) {
		this.queryTwitter('dm_new',{text:status,user:user_id},userSuccessCallback,userErrorCallback);
	},

	destroyDirectMessage: function(status_id,userSuccessCallback,userErrorCallback) {
		//TODO: delete from DMs object + metadata
		this.queryTwitter('dm_destroy',{status_id:status_id},userSuccessCallback,userErrorCallback);
	},

	//convenience method to mimic getTweet. no equivalent API call, so it has to be present in the response arrays
	getDM: function(status_id,userSuccessCallback,userErrorCallback) {
		var found = false;
		if(typeof this.responses.direct_messages != 'undefined') {
			for(var i=0;i < this.responses.direct_messages.length;i++) {
				if(this.responses.direct_messages[i].id == status_id) {
					if(typeof userSuccessCallback == 'function') { userSuccessCallback(this.responses.direct_messages[i]); }
					found = true;
					break;
				}
			}
		}
		if(typeof this.responses.dm_sent != 'undefined' && found != true) {
			for(var j=0;j < this.responses.dm_sent.length;j++) {
				if(this.responses.dm_sent[j].id == status_id) {
					if(typeof userSuccessCallback == 'function') { userSuccessCallback(this.responses.dm_sent[j]); }
					break;
				}
			}
		}
	},

	markAllDMsAsRead : function() {
		for(var i in this.metadata.direct_messages) {
			this.metadata.direct_messages[i].unread = false;
		}
		this.unreadDMs = 0;
	},

	markDMAsRead: function(status_id) {
		if(this.metadata.direct_messages[status_id].unread) {
			this.metadata.direct_messages[status_id].unread = false;
			if(this.unreadDMs >= 1) {
				this.unreadDMs -= 1;
			}
		}
	},

	getDMMetadata: function(status_id) {
		return this.metadata.direct_messages[status_id];
	},

	createFriendship: function(user_id,userSuccessCallback,userErrorCallback) {
		this.queryTwitter('friendships_create',{user_id:user_id},userSuccessCallback,userErrorCallback);
	},

	destroyFriendship: function(user_id,userSuccessCallback,userErrorCallback) {
		this.queryTwitter('friendships_destroy',{user_id:user_id},userSuccessCallback,userErrorCallback);
	},

	createFavorite: function(status_id,userSuccessCallback,userErrorCallback) {
		var self = this;
		function createFavoriteSuccessCallback(parsedObj) {
			/*for(var i=0;i < self.responses.home_timeline.length;i++) {
				if(self.responses.home_timeline[i].id == status_id) {
					self.responses.home_timeline[i].favorited = true;
					break;
				}
			}
			for(var j=0;j < self.responses.mentions.length;i++) {
				if(self.responses.mentions[i].id == status_id) {
					self.responses.mentions[i].favorited = true;
					break;
				}
			}*/
			if(typeof userSuccessCallback == 'function') { userSuccessCallback(parsedObj); }
		}
		this.queryTwitter('favorites_create',{status_id:status_id},createFavoriteSuccessCallback,userErrorCallback);
	},

	destroyFavorite: function(status_id,userSuccessCallback,userErrorCallback) {
		var self = this;
		function destroyFavoriteSuccessCallback(parsedObj) {
			/*for(var i=0;i < self.responses.home_timeline.length;i++) {
				if(self.responses.home_timeline[i].id == status_id) {
					self.responses.home_timeline[i].favorited = false;
					break;
				}
			}
			for(var j=0;j < self.responses.mentions.length;i++) {
				if(self.responses.mentions[j].id == status_id) {
					self.responses.mentions[j].favorited = false;
					break;
				}
			}*/
			if(typeof userSuccessCallback == 'function') { userSuccessCallback(parsedObj); }
		}
		this.queryTwitter('favorites_destroy',{status_id:status_id},destroyFavoriteSuccessCallback,userErrorCallback);
	},

	//TODO: track unread here? refactor to use a more generic object? these get methods are all very similar.
	getFavorites : function(params,userSuccessCallback,userErrorCallback) {
		//by default, get only the most recent favorites
		if(typeof this.responses.favorites != 'undefined' &&typeof this.responses.favorites[0] != 'undefined' && typeof params.since_id == 'undefined') {
			params.since_id = this.responses.favorites[0].id;
		}
		if(typeof params.count == 'undefined') {
			params.count = this.defaultNumTweetsRequested;
		}
		var self = this;
		function favoritesSuccessCallback(parsedObj) {
			self.addTweetMetadata(parsedObj);
			//see if the response array exceeds our allowed limit.
			//if so, truncate and strip the metadata out
			var numToRemove = self.responses['favorites'].length - self.maxTweetsStored;
			if (numToRemove > 0) {
				var index = self.responses['favorites'].length-numToRemove-1; //0 indexed so we need to subtract 1 more
				var removedTweets = self.responses['favorites'].splice(index,numToRemove);
			}
			
			if(typeof userSuccessCallback == 'function') { userSuccessCallback(parsedObj); }
		}
		this.queryTwitter('favorites',params,favoritesSuccessCallback,userErrorCallback);
	},

	getNearbyPlaces: function(params,userSuccessCallback,userErrorCallback) {
		if(params.max_results == 'undefined') {
			params.max_results = 1;
		}
		this.queryTwitter('nearby_places',params,userSuccessCallback,userErrorCallback);
	},

	getTrends: function(userSuccessCallback,userErrorCallback) {
		this.queryTwitter('trends',{},userSuccessCallback,userErrorCallback);
	},

	markAllTweetsAsRead : function() {
		for(var i in this.metadata.tweets) {
			this.metadata.tweets[i].unread = false;
		}
		this.unreadTweets = 0;
		this.unreadMentions = 0;
	},

	markTweetAsRead: function(status_id) {
		if(this.metadata.tweets[status_id].unread) {
			this.metadata.tweets[status_id].unread = false;
			if(this.tweetInHomeTimeline(status_id)) {
				if(this.unreadTweets >= 1) {
					this.unreadTweets -= 1;
				}
			}
			if(this.tweetInMentions(status_id)) {
				if(this.unreadMentions >= 1) {
					this.unreadMentions -= 1;
				}
			}
		}
	},

	tweetInHomeTimeline: function(status_id) {
		console.log('tweetInHomeTimeline'+status_id);
		for(var i=0; i < this.responses.home_timeline.length; i++) {
			if (this.responses.home_timeline[i].id == status_id) {
				return true;
			}
		}
		console.log('didnt find it');
		return false;
	},

	tweetInMentions: function(status_id) {
		for(var i=0; i < this.responses.mentions.length; i++) {
			if (this.responses.mentions[i].id == status_id) {
				return true;
			}
		}
		return false;
	},

	getTweetMetadata: function(status_id) {
		return this.metadata.tweets[status_id];
	},

	//returns number of tweets present in the home_timeline array, or false if it doesn't exist
	//slightly complicated by the fact that 0 and false will evaluate the same with ==. use ===
	numTweetsInTimeline : function() {
		try {
			if(this.responses.home_timeline.length >= 0) {
				return this.responses.home_timeline.length;
			}
		} catch(e) {
			return false;
		}
	},

	//returns true if oauth is complete, false in any other scenario (ie, request token present but not access token)
	checkAuthStatus: function() {
		try {
			if (this.OAuth.oauth_token.search(/^([0-9]+)-/) != -1) {
				return true;
			} else {
				return false;
			}
		} catch(e) {
			return false;
		}
	},

	logging: function(data) {
		if(this.log_to_console) {
			try {
				console.log(data);
			} catch(e) {}
		}
	}
};