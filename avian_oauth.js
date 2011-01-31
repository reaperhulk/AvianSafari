/*
AvianLib: Javascript OAuth for Twitter
Primarily designed for Twitter, this is an OAuth lib written entirely in Javascript (for use in JS environments not bound by cross-domain restrictions.  Appcelerator, WebOS, Safari extensions, Chrome extensions, et cetera). Avian itself is specific to Twitter, but the OAuth object (found in avianlib_oauth.js) should be easily used for different OAuth applications.

Dual Licensed Modified BSD (3-clause) and GPL v2
*/

function OAuth(params) {
	params = params || {};
	this.oauth_consumer_secret = params.oauth_consumer_secret;
	this.oauth_consumer_key = params.oauth_consumer_key;
	this.oauth_token_secret = params.oauth_token_secret;
	this.oauth_token = params.oauth_token;
	this.log_to_console = params.log_to_console || false;
}

OAuth.prototype = {
	logging: function(data) {
		if(this.log_to_console) {
			try {
				console.log(data);
			} catch(e) {}
		}
	},

	//from http://oauth.googlecode.com/svn/code/javascript/oauth.js
	percentEncode : function (s) {
		if (s === null) {
			return "";
		}
		if (s instanceof Array) {
			var e = "";
			for (var i = 0; i < s.length; ++s) {
				if (e != "") e += '&';
				e += this.percentEncode(s[i]);
			}
			return e;
		}
		s = encodeURIComponent(s);
		// Now replace the values which encodeURIComponent doesn't do
		// encodeURIComponent ignores: - _ . ! ~ * ' ( )
		// OAuth dictates the only ones you can ignore are: - _ . ~
		// Source: http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Global_Functions:encodeURIComponent
		s = s.replace(/\!/g, "%21");
		s = s.replace(/\*/g, "%2A");
		s = s.replace(/\'/g, "%27");
		s = s.replace(/\(/g, "%28");
		s = s.replace(/\)/g, "%29");
		return s;
	},

	//from http://oauth.googlecode.com/svn/code/javascript/oauth.js
	nonce : function (length) {
		length = length || 6;
		var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
		var nonce = "";
		for (var i = 0; i < length; ++i) {
			var rnum = Math.floor(Math.random() * chars.length);
			nonce += chars.substring(rnum, rnum+1);
		}
		this.oauth_nonce = nonce;
		this.logging('nonce: '+ nonce);
		return nonce;
	},

	buildSignatureBaseString : function(httpMethod,baseUri,queryParams) {
		var string = httpMethod+"&"+this.percentEncode(baseUri)+"&";
		var params = this.getOAuthParams();
		for (var i in queryParams) {
			if (i == 'oauth_callback') {
				//special case since we want to pull this into the auth header as well.
				this.oauth_callback = queryParams[i];
			}
			params[this.percentEncode(i)] = this.percentEncode(queryParams[i]);
		}
		var keys = this.alphabetize(params);
		var output = [];
		
		/*
		the base string needs to have all arguments in lexicographical order, so we use the alphabetize
		method to get the keys in alphabetical order, then loop over the sorted array and build a new 
		array that has encoded keys+values
		*/
		for (var j = 0; j < keys.length ; j++) {
			output.push(this.percentEncode(keys[j])+"%3D"+this.percentEncode(params[keys[j]]));
			//output.push(this.percentEncode(j+'='+params[j]));
		}
		var baseString = string+output.join("%26");
		this.logging('baseString: '+baseString);
		return baseString;
	},

	//puts keys in lexicographical order (aka alphabetical)
	alphabetize: function(obj) {
		var keys = [];
		for (var k in obj) {
			keys.push(k);
		}
		keys.sort();
		return keys;
	},

	getOAuthParams: function() {
		var oauth_params = {};
		this.logging('initial oauth_params');
		this.logging(oauth_params);
		this.oauth_version = oauth_params['oauth_version'] = '1.0';
		this.oauth_timestamp = oauth_params['oauth_timestamp'] = this.timestamp();
		this.oauth_signature_method = oauth_params['oauth_signature_method'] = 'HMAC-SHA1';
		this.oauth_nonce = oauth_params['oauth_nonce'] = this.nonce();
		oauth_params['oauth_consumer_key'] = this.oauth_consumer_key;
		if(typeof this.oauth_token != 'undefined') {
			oauth_params['oauth_token'] = this.oauth_token;
		}
		this.logging('oauth_params:');
		this.logging(oauth_params);
		return oauth_params;
	},

	timestamp: function() {
		var t = (new Date()).getTime();
		return Math.floor(t / 1000);
	},
    
	//need to figure out how to get the secrets into this function. for now assume they're there
	signString : function(baseString) {
		var oauth_consumer_secret = this.oauth_consumer_secret || '';
		var oauth_token_secret = this.oauth_token_secret || '';

		var key = this.percentEncode(oauth_consumer_secret)+"&"+this.percentEncode(oauth_token_secret);
		this.logging('HMAC-SHA1 Key: '+key);
		var signature = b64_hmac_sha1(key, baseString);
		this.oauth_signature = signature;
		this.logging('Signature: '+ signature);
	},

	generateAuthorizationHeader: function() {
		var header = 'OAuth oauth_nonce="'+this.oauth_nonce+'", ';
		if(typeof this.oauth_callback != 'undefined') {
			header = header+'oauth_callback="'+this.oauth_callback+'", ';
		}
		
		header +=
			'oauth_signature_method="'+this.oauth_signature_method+'", '+
			'oauth_timestamp="'+this.oauth_timestamp+'", '+
			'oauth_consumer_key="'+this.oauth_consumer_key+'", ';

		if(typeof this.oauth_token != 'undefined') {
			header = header+'oauth_token="'+this.oauth_token+'", ';
		}

		header +=
			'oauth_signature="'+this.percentEncode(this.oauth_signature)+'", '+
			'oauth_version="'+this.oauth_version+'"';
		
		this.logging('Authorization header: '+ header);
		
		return header;
	},

	request : function(url,method,params,successCallback,errorCallback) {
		var baseString = this.buildSignatureBaseString(method,url,params);
		this.signString(baseString);
		var header = this.generateAuthorizationHeader();
		var self = this;
		
		//default callback, used for request token/access token requests
		if(typeof successCallback != 'function') {
			successCallback = function(data, textStatus, xhr) {
				self.logging('Default success callback, this is normally overridden.');
				self.logging(textStatus);
				self.logging(xhr);
				self.logging('Raw callback data:');
				self.logging(data);
			};
		}
		if(typeof errorCallback != 'function') {
			errorCallback = function(xhr, textStatus, errorThrown) {
				self.logging('Default error callback, this is normally overridden.');
				self.logging(textStatus);
				self.logging(xhr);
				self.logging('Error thrown:');
				self.logging(errorThrown);
			};
		}
		$.ajax({
			url: url,
			type: method,
			dataType: 'text',
			data: params,
			beforeSend: function(xhr) {
				xhr.setRequestHeader('Authorization', header);
			},
			success: successCallback,
			error: errorCallback
		});
	},

	/*
	warning, if oauth_token is already set then calling this method for a new request token 
	will return an invalid signature.  unset it if you want to start over. (see Avian.getRequestToken)
	*/
	getToken: function(tokenUrl,method,params,userSuccessCallback,userErrorCallback) {
		var self = this;
		var successCallback = function(data, textStatus, xhr) {
			if(xhr.status != 200) {
				console.log('success fired but error really should have.');
				console.log(xhr);
			}
			self.logging(textStatus);
			self.logging(xhr);
			self.logging('Raw callback data:');
			self.logging(data);
			var dataArr = data.split("&");
			var decoded = {};
			for(var i=0;i < dataArr.length;i++) {
				var split = decodeURIComponent(dataArr[i]).split("=");
				decoded[split[0]] = split[1];
			}
			self.logging('Decoded callback data:');
			self.logging(decoded);
			self.oauth_token = decoded.oauth_token;
			self.oauth_token_secret = decoded.oauth_token_secret;
			/*if(dataArr.length == 4) {
				self.user_id = decoded.user_id;
				self.screen_name = decoded.screen_name;
			}*/
			if(typeof userSuccessCallback == 'function') { userSuccessCallback(decoded); }
		};
		var errorCallback = function(xhr, textStatus, errorThrown) {
			self.logging('Error...');
			self.logging(textStatus);
			self.logging(xhr);
			self.logging('Error thrown:');
			self.logging(errorThrown);
			if(typeof userErrorCallback == 'function') { userErrorCallback(errorThrown); }
		};
		this.request(tokenUrl,method,params,successCallback,errorCallback);
	}
};
