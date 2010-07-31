var handleMessage = function(event) {
	if (event.name == 'aviansafari' && event.message == 'success') {
		window.location.href = '/aviansafari/';
	}
};
console.log('i have been injected');
safari.self.addEventListener("message", handleMessage, false);

safari.self.tab.dispatchMessage('aviansafari','confirmed');