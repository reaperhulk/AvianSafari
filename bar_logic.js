var tweetsLoaded = false;
var mentionsLoaded = false;
var directMessagesLoaded = false;
var directMessagesSentLoaded = false;

var g = safari.extension.globalPage.contentWindow;
safari.self.browserWindow.addEventListener("command", captureCommand, false);
safari.self.browserWindow.addEventListener("message", captureMessage, false);

function captureCommand(event) {
	if (event.command !== 'aviansafari-toggle') {
		return;
	}
	switch (safari.extension.settings.toolbarButtonBehavior) {
		case 'composeTweet':
			showTweetFace();
		break;
		case 'markAllAsRead':
			g.markAllAsRead();
		break;
		case 'showHide':
			if(safari.self.visible) {
				safari.self.hide();
			} else {
				safari.self.show();
			}
		break;
	}
}

function captureMessage(event) {
	if(event.name == 'aviansafari-retweet') {
		retweet(event.message);
	}
	if(event.name == 'aviansafari-reply') {
		replySetup(event.message);
	}
}

var authStatusTimer = window.setTimeout(checkAuthAndStatus, 50);
var authChecker = 0;

function checkAuthAndStatus() {
	try {
		var authStatus = g.Avian.checkAuthStatus();
	} catch(e) {
		console.log('tried to checkAuth but object wasn\'t available yet');
		if(authChecker < 10) {
			authStatusTimer = window.setTimeout(checkAuthAndStatus, 50);
			authChecker++;
		} else {
			$('#auth-status').html('Unable to instantiate global page objects. Tell dev to increase timeout.');
		}
		return;
	}
	if(authStatus) {
		$('#auth-status').hide();
		$('#tweet-load').show();
		var count = g.Avian.numTweetsInTimelines();
		if(count.home_timeline == 0 && count.mentions == 0 && count.direct_messages == 0 && count.dm_sent == 0) {
			g.setUpdateInterval(safari.extension.settings.getItem('updateInterval'),true);
			g.updateData();
		} else {
			if(tweetsLoaded == false && count.home_timeline > 0) {
				g.populateTweetBar(safari.self);
			}
			if(mentionsLoaded == false && count.mentions > 0) {
				g.populateMentionsBar(safari.self);
			}
			if(directMessagesLoaded == false && count.direct_messages > 0) {
				g.populateDMBar(safari.self);
			}
			if(directMessagesSentLoaded == false && count.dm_sent > 0) {
				g.populateSentDMBar(safari.self);
			}
			g.updateTrends();
		}
	} else {
		$('#auth-status').show();
		$('#tweet-load').hide();
	}
}

function retweet(status_id) {
	if(!confirm('Are you sure you want to retweet this?')) {
		return;
	}
	function retweetSuccess(data) {
		alert('Retweet successful.');
	}
	g.Avian.retweet(status_id,retweetSuccess);
}

function replySetup(in_reply_to_status_id) {
	g.Avian.getTweet(in_reply_to_status_id,getTweetSuccess);
	function getTweetSuccess(data) {
		var returned = g.generateTweetInfo(data);
		var in_reply_to_status_id = returned.status_id;
		var screen_name = returned.user.screen_name;
		$('.create-tweet .in_reply_to_status_id').val(in_reply_to_status_id);
		var tweetText = $('.create-tweet .tweet-text');
		tweetText.val('@'+screen_name+' ');
		checkTweetLength();
		var tweetHTML = g.generateTweetBody([data]);
		var clonedTweet = $(tweetHTML);
		clonedTweet.find('.options').remove();
		clonedTweet.find('.overlay').remove();
		var totalWidth = $('.create-tweet').width();
		var currentEdge = $('.replying-to-tweet').position().left;
		var availableSpace = totalWidth - currentEdge - 80; //70px is for avatar + padding in this case
		clonedTweet.removeClass('tweet').addClass('static-tweet');
		clonedTweet.find('.content').css('max-width',availableSpace);
		$('.create-tweet .replying-to-tweet').empty().append(clonedTweet);
		$('#controls button').removeClass('toggled');
		$('#status-update').addClass('toggled');
		document.querySelector('#box-container').className = 'show-create-tweet';
		window.setTimeout("var tweetText = $('.create-tweet .tweet-text');var range = tweetText.val().length;tweetText.get(0).setSelectionRange(range,range);tweetText.focus();",1000);
	}
}

function dmReplySetup(status_id) {
	g.Avian.getDM(status_id,getDMSuccess);
	function getDMSuccess(data) {
		var returned = g.generateTweetInfo(data);
		var status_id = returned.status_id;
		var screen_name = returned.user.screen_name;
		var tweetText = $('.create-tweet .tweet-text');
		tweetText.val('d '+screen_name+' ');
		checkTweetLength();
		var tweetHTML = g.generateTweetBody([data]);
		var clonedTweet = $(tweetHTML);
		clonedTweet.find('.options').remove();
		clonedTweet.removeClass('tweet').addClass('static-tweet');
		clonedTweet.find('.content').css('max-width','300px');
		$('.create-tweet .replying-to-tweet').empty().append(clonedTweet);
		$('#controls button').removeClass('toggled');
		$('#status-update').addClass('toggled');
		document.querySelector('#box-container').className = 'show-create-tweet';
		window.setTimeout("var tweetText = $('.create-tweet .tweet-text');var range = tweetText.val().length;tweetText.get(0).setSelectionRange(range,range);tweetText.focus();",1000);
	}
}


function numVisibleTweets(selector) {
	var totalWidth = $(selector).width();
	var tweetWidth = $(selector+' .tweet').last().width();
	return Math.floor(totalWidth/tweetWidth);
}

function getPageSelector() {
	var selector;
	switch (document.getElementById('box-container').className) {
		case 'show-timeline':
			selector = '.face.timeline';
		break;
		case 'show-mentions':
			selector = '.face.mentions';
		break;
		case 'show-dm':
			//DMs have two inside the one face. figure out which one is currently visible.
			var toggled = document.getElementById('dm-received').className;
			if (toggled == 'toggled') {
				selector = '.direct-messages-received';
			} else {
				selector = '.direct-messages-sent';
			}
		break;
		case 'show-create-tweet':
			selector = '.face.create-tweet';
		break;
		case 'show-search':
			selector = '.face.search';
		break;
		case 'show-trends':
			selector = '.face.trends';
		break;
	}
	return selector;
}

var pageAnimationInProgress = false;
function nextPage() {
	if(pageAnimationInProgress) { return; }
	pageAnimationInProgress = true;
	var selector = getPageSelector();
	var visibleTweets = numVisibleTweets(selector);
	var totalWidth = $(selector).width();
	var tweets = $(selector+' .tweet:visible');
	if(tweets.length <= visibleTweets) {
		pageAnimationInProgress = false;
		return;
	}
	for(var i = 0; i < visibleTweets;i++) {
		$(tweets[i]).animate({left: '-='+totalWidth+'px'}, 333, success);
	}
	function success() {
		pageAnimationInProgress = false;
		$(this).hide();
	}
	//this line is confusing but remember that tweets.length has been reduced by the #
	//visibleTweets at this point. they were shifted and hidden.
	if(tweets.length - visibleTweets <= visibleTweets) {
		//next page is the last page, dim the right arrow
		console.log('last page');
	} else {
		//undim arrow
	}
}

function prevPage() {
	if(pageAnimationInProgress) { return; }
	pageAnimationInProgress = true;
	var selector = getPageSelector();
	var visibleTweets = numVisibleTweets(selector);
	var totalWidth = $(selector).width();
	var tweets = $(selector+' .tweet:hidden');
	if(tweets.length == 0) {
		pageAnimationInProgress = false;
		return;
	}
	for(var i = 1; i <= visibleTweets;i++) {
		var index = tweets.length-i;
		$(tweets[index]).show();
		$(tweets[index]).animate({left: 0}, 333, success);
	}
	function success() {
		pageAnimationInProgress = false;
	}
	if(tweets.length - visibleTweets <= 0) {
		//next page is the first page, dim the left arrow
		console.log('first page');
	} else {
		//undim arrow
	}
}

function firstPage() {
	var selector = getPageSelector();
	var tweets = $(selector+' .tweet:hidden');
	tweets.css('left',0).show();
}

function sendTweet(update) {
	if(update === null) {
		return;
	}
	var match = update.match(/^d \w+ /);
	var maxLength = 140;
	if(match !== null) {
		maxLength = 140 + match[0].length;
	}

	if(update.length > maxLength) {
		alert('Tweet length exceeds 140 characters.');
		return;
	}
	$('#tweet-loading').fadeIn();

	var in_reply_to_status_id = $('.create-tweet .in_reply_to_status_id').val();

//	var geolocation = safari.extension.settings.geolocation;
	//geolocation support is not enabled in extensions at this time. pain in the ass. default it to off.
	//reminder to self: dms don't support this so when enabled this will need to exclude DMs
	var geolocation = false;
	if(geolocation) {
		alert('getting geolocation position. this is slow sometimes...');
		navigator.geolocation.getCurrentPosition(function(position) {
			console.log(position);
			var latitude = position.coords.latitude;
			var longitude = position.coords.longitude;
			if(in_reply_to_status_id != '') {
				g.Avian.replyToTweet({status:update,in_reply_to_status_id:in_reply_to_status_id,lat:latitude,lon:longitude},updateSuccess);
			} else {
				g.Avian.queryTwitter('update',{status:update,lat:latitude,lon:longitude},updateSuccess);
			}
		}, function(error) {
			switch(error.code) {
   				case error.TIMEOUT:
					alert ('Timeout');
					break;
				case error.POSITION_UNAVAILABLE:
					alert ('Position unavailable');
					break;
				case error.PERMISSION_DENIED:
					alert ('Permission denied');
					break;
				case error.UNKNOWN_ERROR:
					alert ('Unknown error');
					break;
			}
		});
	} else {
		if(in_reply_to_status_id != '') {
			g.Avian.replyToTweet({status:update,in_reply_to_status_id:in_reply_to_status_id},updateSuccess,updateError);
		} else {
			g.Avian.queryTwitter('update',{status:update},updateSuccess,updateError);
		}
	}
	function updateSuccess(data) {
		if(match !== null) {
			g.updateSentDirectMessages();
		} else {
			g.updateTimeline();
		}
		$('.create-tweet .in_reply_to_status_id').val('');
		$('.create-tweet .tweet-text').val('');
		checkTweetLength();
		$('#tweet-loading').fadeOut();
	}
	function updateError(data) {
		//handle the error
		$('#tweet-loading').fadeOut();
	}
}

function checkTweetLength() {
	var tweet = $('.create-tweet .tweet-text').val();
	//a direct message starts with "d username " and those chars do not count against the 140 char limit
	//check for the presence of DM syntax
	var remaining;
	var match = tweet.match(/^d \w+ /);
	if(match !== null) {
		remaining = 140 + match[0].length - tweet.length;
	} else {
		remaining = 140 - tweet.length;
	}
	$('.create-tweet .chars-left').html(remaining);
}

//this won't work properly for multiple links
function shortenLinks() {
	var tweet = $('.create-tweet textarea').val();
	var matches = tweet.match(/\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.])(?:[^\s()<>]+|\([^\s()<>]+\))+(?:\([^\s()<>]+\)|[^`!()\[\]{};:'".,<>?«»“”‘’\s]))/gi);
	if (matches){
		for (var j=0; j < matches.length; j++) {
			var actualUrl;
			if(matches[j].match(/http/) === null) {
				actualUrl = 'http://'+matches[j];
			} else {
				actualUrl = matches[j];
			}
			var userCreds = '';
			switch(safari.extension.settings.shortener) {
				case 'tinyvh':
					$.get('http://tinyvh.com/api.php?url='+encodeURIComponent(actualUrl),makeCallback(matches[j], tinySuccess));
				break;
				case 'tinyurl':
					$.get('http://tinyurl.com/api-create.php?url='+encodeURIComponent(actualUrl),makeCallback(matches[j], tinySuccess));
				break;
				case 'isgd':
					$.get('http://is.gd/api.php?longurl='+encodeURIComponent(actualUrl),makeCallback(matches[j], tinySuccess));
				break;
				case 'lessnmore':
				var lessnmore_url = safari.extension.settings.lessnmore_url;
				var lessnmore_api = safari.extension.settings.lessnmore_api;
					$.get('http://'+lessnmore_url+'/?api='+lessnmore_api+'&url='+encodeURIComponent(actualUrl),makeCallback(matches[j], tinySuccess));
				break;
				case 'bitly':
				if(safari.extension.settings.x_login !== undefined && safari.extension.settings.x_apiKey !== undefined && safari.extension.settings.x_login.length > 0 && safari.extension.settings.x_apiKey.length > 0) {
						userCreds = '&x_login='+safari.extension.settings.x_login+'&x_apiKey='+safari.extension.settings.x_apiKey;
					}
					$.get('http://api.bit.ly/v3/shorten?login='+bitlyLogin+'&apiKey='+bitlyApiKey+'&format=json&longUrl='+encodeURIComponent(actualUrl)+userCreds,makeCallback(matches[j], bitlySuccess));
				
				break;
				case 'jmp':
				if(safari.extension.settings.x_login !== undefined && safari.extension.settings.x_apiKey !== undefined && safari.extension.settings.x_login.length > 0 && safari.extension.settings.x_apiKey.length > 0) {
						userCreds = '&x_login='+safari.extension.settings.x_login+'&x_apiKey='+safari.extension.settings.x_apiKey;
					}
				$.get('http://api.j.mp/v3/shorten?login='+bitlyLogin+'&apiKey='+bitlyApiKey+'&format=json&longUrl='+encodeURIComponent(actualUrl)+userCreds,makeCallback(matches[j], bitlySuccess));
				break;
			}
		}
	}
	function makeCallback(match, fn) {
		return function(data) {
			fn(data, match);
		};
	}
	function tinySuccess(data, match) {
		tweet = tweet.replace(match,data);
		$('.create-tweet textarea').val(tweet);
		checkTweetLength();
	}
	function bitlySuccess(data, match) {
		if(data.status_code == "200") {
			tweet = tweet.replace(match,data.data.url);
			$('.create-tweet textarea').val(tweet);
			checkTweetLength();
		} else {
			//error handling here at some point
		}
	}
}

function followLink(url) {
	/*
	this code will decode an IDN domain since there is a bug in Safari 5 with using the 
	SafariBrowserTab.url property to redirect to IDN. remove when the bug is fixed.
	rdar://8367696
	*/
	function resolveIDNA(url) {
		var a = document.createElement("a");
		a.href = url;
		return a.href;
	}
	url = resolveIDNA(url);
	switch(safari.extension.settings.linkBehavior) {
		case 'newTab':
			tabFocus = safari.extension.settings.tabFocus;
			tabPosition = safari.extension.settings.tabPosition;
			var tabIndex = currentTabIndex();
			var tab = safari.application.activeBrowserWindow.openTab(tabFocus);
			switch(tabPosition) {
				case 'right':
					safari.application.activeBrowserWindow.insertTab(tab,tabIndex+1);
				break;
				case 'left':
					safari.application.activeBrowserWindow.insertTab(tab,tabIndex);
				break;
				case 'beginning':
					safari.application.activeBrowserWindow.insertTab(tab,0);
				break;
				case 'end':
				break;
			}
			tab.url = url;
		break;
		case 'currentTab':
			safari.application.activeBrowserWindow.activeTab.url = url;
		break;
		case 'newWindow':
			var createdWindow = safari.application.openBrowserWindow();
			createdWindow.activeTab.url = url;
		break;
	}
}

function currentTabIndex() {
	var tabs = safari.application.activeBrowserWindow.tabs;
	for (var i=0;i < tabs.length;i++) {
		if (safari.application.activeBrowserWindow.activeTab == tabs[i]) {
			return i;
		}
	}
	return false;
}

function showTweetFace() {
	$('.create-tweet .in_reply_to_status_id').val('');
	$('.create-tweet .tweet-text').val('');
	checkTweetLength();
	$('.create-tweet .replying-to-tweet').empty();
	$('#controls button').removeClass('toggled');
	$('#status-update').addClass('toggled');
	document.querySelector('#box-container').className = 'show-create-tweet';
	window.setTimeout("$('.create-tweet .tweet-text').focus()",1000);
}

$(document).ready(function() {
	$('#search-button').click(function() {
		$('#controls button').removeClass('toggled');
		$(this).addClass('toggled');
		document.querySelector('#box-container').className = 'show-search';
		window.setTimeout("$('#twitter-search input').focus()",1000);
		return false;
	});

	$('#trends-button').click(function() {
		$('#controls button').removeClass('toggled');
		$(this).addClass('toggled');
		document.querySelector('#box-container').className = 'show-trends';
		return false;
	});

	$('#auth-status').click(function() {
		var self = this;
		$(this).html('Authorization in progress...');
		function success(data) {
			if(data.oauth_token !== undefined) {
				$(self).html('Log in/approve access to your Twitter account...');
				var tab = safari.application.activeBrowserWindow.openTab();
				tab.url = 'https://api.twitter.com/oauth/authorize?oauth_token='+data.oauth_token;
			}
		}
		g.Avian.getRequestToken(success);
	});

	$('#status-update').click(function() {
		showTweetFace();
		return false;
	});

	$('#home-timeline').click(function() {
		if($(this).hasClass('toggled')) {
			firstPage();
			return false;
		}
		$('#controls button').removeClass('toggled');
		$(this).addClass('toggled');
		document.querySelector('#box-container').className = 'show-timeline';
		return false;
	});

	$('#mentions').click(function() {
		if($(this).hasClass('toggled')) {
			firstPage();
			return false;
		}
		$('#controls button').removeClass('toggled');
		$(this).addClass('toggled');
		var boxContainer = document.querySelector('#box-container');
		boxContainer.className = 'show-mentions';
		return false;
	});

	$('#direct-messages').click(function() {
		if($(this).hasClass('toggled')) {
			firstPage();
			return false;
		}
		$('#controls button').removeClass('toggled');
		$(this).addClass('toggled');
		var boxContainer = document.querySelector('#box-container');
		boxContainer.className = 'show-dm';
		return false;
	});

	$('#refresh').click(function() {
		g.updateData();
		return false;
	});

	$('#twitter-search').submit(function(event) {
		var search = encodeURIComponent($('#twitter-search input').val());
		followLink('http://search.twitter.com/search?q='+search);
		return false;
	});

	$('#mark-all-as-read').click(function() {
		g.markAllAsRead();
		return false;
	});

	$('#next-page').click(function() {
		nextPage();
		return false;
	});

	$('#prev-page').click(function() {
		prevPage();
		return false;
	});
	
	$('#send-tweet').click(function() {
		sendTweet($('.create-tweet .tweet-text').val());
		return false;
	});

	$('#shorten').click(function() {
		shortenLinks();
		$('.create-tweet .tweet-text').focus();
		return false;
	});

	$('#get-current-link').click(function() {
		var tweetText = $('.create-tweet .tweet-text');
		$(tweetText).val(tweetText.val()+safari.application.activeBrowserWindow.activeTab.url);
		var range = tweetText.val().length;
		tweetText.focus();
		tweetText.get(0).setSelectionRange(range,range); //set the cursor to the end.
		checkTweetLength();
		return false;
	});

	$('.create-tweet .tweet-text').keyup(function(event) {
		checkTweetLength();
	});

	$('.create-tweet .tweet-text').keydown(function(event) {
		if(event.keyCode == 13 && event.metaKey == true) {
			sendTweet($(this).val());
			return false;
		}
		if(event.keyCode == 83 && event.metaKey == true && event.shiftKey == true) {
			shortenLinks();
			return false;
		}
	});

	$('#dm-received').click(function() {
		$('.direct-messages-sent').fadeOut();
		$('.direct-messages-received').fadeIn();
		$('#dm-sent').removeClass('toggled');
		$(this).addClass('toggled');
	});

	$('#dm-sent').click(function() {
		$('.direct-messages-received').fadeOut();
		$('.direct-messages-sent').fadeIn();
		$('#dm-received').removeClass('toggled');
		$(this).addClass('toggled');
	});

	$('span.unread').live('click',function(event) {
		var tweet = $(this).parent();
		var type = tweet.attr('type');
		if(type == 'tweet' || type == 'retweet') {
			g.markTweetAsRead(tweet.attr('status_id'));
		} else if (type == 'dm') {
			g.markDMAsRead(tweet.attr('status_id'));
		}
	});

	$('div[type=tweet] .content,div[type=retweet] .content').live('click', function(event) {
		g.markTweetAsRead($(this).parents('.tweet').attr('status_id'));
	});

	$('div[type=dm] .content').live('click', function(event) {
		var tweet = $(this).parent();
		g.markDMAsRead(tweet.attr('status_id'));
	});

	$('.tweet').live('mouseenter mouseleave', function(event) {
		var options = $(this).find('.options');
		var content = $(this).find('.content');
		if(event.type == 'mouseenter') {
			var totalWidth = $(this).parent().width();
			var currentEdge = $(this).position().left + $(this).width();
			
			var availableSpace = totalWidth - currentEdge - 14; //14 for the width of the options div that will appear
			var allowedMaxWidth = (availableSpace <= 185)?availableSpace+165:350;
			if (availableSpace <= 0) {
				allowedMaxWidth = 151; //reduce total width to try to handle the case where there's no space but we need to show the reply/retweet column
			}
			content.css('max-width',allowedMaxWidth);
			options.stop(true).delay(600).animate({width:'14px',height:'25px'},200);
		} else {
			options.stop(true).delay(600).animate({width:'1px',height:'1px'},200);
			content.css('max-width',165);
		}
	});

	$('.tweet .reply').live('click', function(event) {
		var in_reply_to_status_id = $(this).parent().parent().attr('status_id');
		/*
		when clicking a link in the tweet div (be it @mention, #hashtag, url, or avatar), it's 
		hopefully a safe assumption that the tweet should be marked as read.
		*/
		g.markTweetAsRead(in_reply_to_status_id); //this is the status_id of the current tweet div, as seen above
		replySetup(in_reply_to_status_id);
	});

	$('.tweet .retweet').live('click', function(event) {
		var status_id = $(this).parent().parent().attr('status_id');
		/*
		when clicking a link in the tweet div (be it @mention, #hashtag, url, or avatar), it's 
		hopefully a safe assumption that the tweet should be marked as read.
		*/
		g.markTweetAsRead(status_id);
		retweet(status_id);
	});

	//TODO: incorporate this into the replySetup(). will need new methods in avianlib (getDM like getTweet)
	$('.tweet .dm-reply').live('click', function(event) {
		var status_id = $(this).parent().parent().attr('status_id');
		/*
		when clicking a link in the tweet div (be it @mention, #hashtag, url, or avatar), it's 
		hopefully a safe assumption that the tweet should be marked as read.
		*/
		g.markDMAsRead(status_id);
		dmReplySetup(status_id);
	});

	$('.tweet .destroy').live('click', function(event) {
		var tweet = $(this).parent().parent();
		var status_id = tweet.attr('status_id');
		if(!confirm('Are you sure you want to delete this tweet? This cannot be undone.')) {
			return;
		}
		tweet.find('.activity').fadeIn();
		g.destroyTweet(status_id);
	});

	$('.tweet .dm-destroy').live('click', function(event) {
		var tweet = $(this).parent().parent();
		var status_id = tweet.attr('status_id');
		if(!confirm('Are you sure you want to delete this DM? This cannot be undone.')) {
			return;
		}
		tweet.find('.activity').fadeIn();
		g.destroyDM(status_id);
	});

	$('#box-container').live('mousewheel', function(event) {
		//the event is actually a jquery event. we want the original so we can determine deltaX or deltaY
		var originalEvent = event.originalEvent;
		//determine which dimension we're scrolling more in and use that to determine which way to page.
		//TODO: this method has trouble with inertial scrolling
		var wheelDelta = (Math.abs(originalEvent.wheelDeltaY)-Math.abs(originalEvent.wheelDeltaX) > 0)?originalEvent.wheelDeltaY:originalEvent.wheelDeltaX;
		if(wheelDelta > 0) {
			prevPage();
		} else {
			nextPage();
		}
	});

	$('.tweet').live('dblclick', function(event) {
		var status_id = $(this).attr('status_id');
		if ($(this).attr('type') == 'dm') {
			return;
		}
		followLink(safari.extension.baseURI+'viewThread.html?status_id='+status_id);
	});
	
	$('.tweet a,.trend a,.static-tweet a').live('click',function() {
		followLink($(this).attr("href"));
		/*
		when clicking a link in the tweet div (be it @mention, #hashtag, url, or avatar), it's 
		hopefully a safe assumption that the tweet should be marked as read.
		*/
		g.markTweetAsRead($(this).parents('.tweet').attr('status_id'));
		return false;
	});

	//commented out for initial release.
	/*$('.tweet').live('contextmenu',function() {
		if ($(this).attr('type') == 'dm') {
			return false;
		}
		var overlay= $(this).find('.overlay');
		overlay.animate({ left: parseInt(overlay.css('left'),10) == 0 ?400:0});
		return false;
	});*/

	$('.tweet .overlay .is-favorite').live('click', function() {
		var status_id = $(this).parent().parent().attr('status_id');
		g.Avian.destroyFavorite(status_id, success);
		var self = this;
		function success(data) {
			$(self).hide();
			$(self).parent().find('.not-favorite').show();
		}
	});

	$('.tweet .overlay .not-favorite').live('click', function() {
		var status_id = $(this).parent().parent().attr('status_id');
		g.Avian.createFavorite(status_id, success);
		var self = this;
		function success(data) {
			$(self).hide();
			$(self).parent().find('.is-favorite').show();
		}
	});
});
