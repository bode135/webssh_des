
# New commit: Use des encrypt auth info for auto login (使用des加密GET登录信息)


- [webssh原版链接](https://github.com/huashengdun/webssh)


首先感谢开源的`webssh`项目, 我把它集成进了我自己的Django-admin后台中, 实现了类似堡垒机的自动登录.

但感觉原有的自动登录通过GET传参和`postMessage`方法都不太安全, 就自己实现了使用DES算法加密后的`ct`传参, 略微提升了安全性, 并及时报废登录密文, 防御了重放攻击.

虽然通过查阅前端js源码还是能破解, 但搭配https的话应该比较稳定了.



## 使用对比

> 假设webssh的服务器为`www.domain.com`, ssh目标服务器验证信息为`{ "username": "root", "password": "passwd", "hostname": "localhost", "port": 22 }`

### 首先服务端运行

> nginx配置参考原项目`Readme.md`

```
python run.py --address='127.0.0.1' --port=28000 --forbiddenindex=true
```


### 原来的自动登录请求

```
http://www.domain.com/api/webssh/?hostname=localhost&username=root&password=cGFzc3dk
```



### 现在的自动登录使用密文传输

> 传递加密后的密文ciphertext即可, 如`www.domain.com?ct=xxx`

```
// 定义密钥key和需要加密的message
var key = "TESTKEY2";
var message = { "username": "root", "password": "passwd", "hostname": "10.120.65.140", "port": 22240, "time": Date.now() };


// 加密(引入js和`encryptByDES`函数见下文js加密实现)
var msg_str = JSON.stringify(message);
var ct = encryptByDES(msg_str, key);

// 密文
console.log('*** ciphertext :', ct);


// 只需要将密文ct传过去即可
http://www.domain.com/?ct=xxx

```



### 服务端新增参数

新增两个参数`key`和`forbiddenindex`

- `key`: DES密钥, 默认`TESTKEY2`
- `forbiddenindex`: 禁止使用`index.html`, 必须通过`ct`密文登录. 默认`false`.



## 基于DES的加密解密

### js实现DES加密解密 

> 复制粘贴即可

####  引入js并定义加密解密函数

```
# --- 引入js

// h5静态引入
// <script src="https://cdn.bootcss.com/crypto-js/3.1.9-1/crypto-js.min.js"></script>

// js动态引入
var script = document.createElement('script');
script.src = 'https://cdn.bootcss.com/crypto-js/3.1.9-1/crypto-js.min.js';
document.head.appendChild(script);

// --- 实现加密方法

// DES加密
function encryptByDES(message, key){
    var keyHex = CryptoJS.enc.Utf8.parse(key);
    var encrypted = CryptoJS.DES.encrypt(message, keyHex, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.ciphertext.toString();
}

// DES解密
function decryptByDES(ciphertext, key){
    var keyHex = CryptoJS.enc.Utf8.parse(key);
    var decrypted = CryptoJS.DES.decrypt({
        ciphertext: CryptoJS.enc.Hex.parse(ciphertext)
    }, keyHex, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    var result_value = decrypted.toString(CryptoJS.enc.Utf8);
    return result_value;
}

```



####  使用

```
// --- 定义变量
var key = "TESTKEY2";
var message = { "username": "root", "password": "passwd", "hostname": "10.120.65.140", "port": 22240, "time": Date.now() };
var msg_str = JSON.stringify(message);
console.log('--- msg_str:', msg_str);

// 加密
var ciphertext = encryptByDES(msg_str, key);
console.log('--- ciphertext:', ciphertext);

// 解密
var new_msg_str = decryptByD	ES(ciphertext.toUpperCase(), key)
var new_message = JSON.parse(new_msg_str);
console.log('--- new_message:', new_message);

```



### Python实现DES加密解密

- 参考`webssh/tools/my_des.py`



## 主要改动

- `settings.py`新增两个参数`key`和`forbiddenindex`
  - `key`: DES加密密钥, 默认`TESTKEY2`
  - `forbiddenindex`: 禁止使用`index.html`, 必须通过`ct`密文登录. 默认`false`

   - 在`webssh/templates/index.html`中加入了`crypto-js.min.js`

- 在`webssh/static/main.js`中修改了`parse_url_data`方法, 并增加了部分工具函数.

- 增加`webssh/tools/my_des.py`文件, 其中有python环境的des加密解密工具.

- 刚开始用前端实现的加密解密, 后面发现还是得在服务端处理这些..

     改动文件如图:

     ![image-20230117151802655](https://tuchuang-bode135.oss-cn-beijing.aliyuncs.com/img/image-20230117151802655.png)



### 提升安全性思路

  1. 使用DES算法, 设置好密钥后, 对所有参数`["hostname", "port", "username", "password"]`进行加密.

  2. 防御重放攻击: 由于是GET请求, 所以使用过的密文都必须报废. 思路如下:

     2.1 先校验客户端请求的密文是否在已被使用过的密文缓存中, 如果在, 则报废.
     2.2 在构造密文时, 加入当前时间戳"time"参数
     2.3 客户端发送请求的时间与当前服务器时间相差不能超过3分钟
     2.4 缓存报废密文库, 保存最近3分钟使用过的密文



## 使用效果截图



1. 必须通过Django的后台打开webssh终端标签页

![image-20230117152623820](https://tuchuang-bode135.oss-cn-beijing.aliyuncs.com/img/image-20230117152623820.png)



![image-20230117152609131](https://tuchuang-bode135.oss-cn-beijing.aliyuncs.com/img/image-20230117152609131.png)

2. 用户无法通过新标签页登录

   1. 新标签页打开

      ![image-20230117152719716](https://tuchuang-bode135.oss-cn-beijing.aliyuncs.com/img/image-20230117152719716.png)

      

   2. 无法通过抓包打开

      ![image-20230117152856372](https://tuchuang-bode135.oss-cn-beijing.aliyuncs.com/img/image-20230117152856372.png)

      

3. 前端生成的ct使用一次后报废, 报错截图:

![image-20230117152742664](https://tuchuang-bode135.oss-cn-beijing.aliyuncs.com/img/image-20230117152742664.png)

