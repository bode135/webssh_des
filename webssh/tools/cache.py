import time
import threading
from datetime import datetime


def get_seconds_diff(t1, t2):
    # 获得两时间间隔`t1 - t2`
    datetime1 = datetime.fromtimestamp(t1)
    datetime2 = datetime.fromtimestamp(t2)
    time_diff = datetime1 - datetime2
    return time_diff.total_seconds()


class Cache:
    def __init__(self):
        self.cache = {}
        self.expirations = {}

    def set(self, key, value, expired_time=None):
        self.cache[key] = value
        if expired_time:
            self.expirations[key] = time.time() + expired_time

    def get(self, key):
        if key in self.cache:
            if key in self.expirations:
                if time.time() > self.expirations[key]:
                    del self.cache[key]
                    del self.expirations[key]
                    return None
            return self.cache[key]
        else:
            return None

    def delete_expired_keys(self):
        current_time = time.time()
        expired_keys = [key for key in self.expirations if current_time > self.expirations[key]]
        for key in expired_keys:
            # print(f'--- delete_expired_keys --- {key}')
            del self.cache[key]
            del self.expirations[key]

    def _start_expired_keys_cleaner(self, interval=10):
        while True:
            time.sleep(interval)
            self.delete_expired_keys()

    def start_expired_keys_cleaner(self, interval=10):
        t1 = threading.Thread(target=self._start_expired_keys_cleaner, args=(interval, ))
        t1.start()


cache = Cache()


if __name__ == '__main__':
    cache = Cache()
    cache.set("key1", "value1", 2)  # This key-value pair will expire in 10 seconds.
    cache.start_expired_keys_cleaner(
        interval=3)  # This method will run in background, cleaning the expired keys every 5 seconds.
    print(cache.get("key1"))  # "value1"
    time.sleep(15)
    print(cache.get("key1"))  # None
