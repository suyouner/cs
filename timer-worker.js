let timerId = null;

self.addEventListener('message', (e) => {
    if (e.data === 'start') {
        if (!timerId) {
            timerId = setInterval(() => {
                self.postMessage('tick');
            }, 60000); // 1分钟
        }
    } else if (e.data === 'stop') {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }
});
