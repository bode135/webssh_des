/*jslint browser:true */

var jQuery;
var wssh = {};


(function () {
  // For FormData without getter and setter
  var proto = FormData.prototype,
    data = {};

  if (!proto.get) {
    proto.get = function (name) {
      if (data[name] === undefined) {
        var input = document.querySelector('input[name="' + name + '"]'),
          value;
        if (input) {
          if (input.type === 'file') {
            value = input.files[0];
          } else {
            value = input.value;
          }
          data[name] = value;
        }
      }
      return data[name];
    };
  }

  if (!proto.set) {
    proto.set = function (name, value) {
      data[name] = value;
    };
  }
}());


jQuery(function ($) {
  var status = $('#status'),
    button = $('.btn-primary'),
    form_container = $('.form-container'),
    waiter = $('#waiter'),
    term_type = $('#term'),
    style = {},
    default_title = 'WebSSH',
    title_element = document.querySelector('title'),
    form_id = '#connect',
    debug = document.querySelector(form_id).noValidate,
    custom_font = document.fonts ? document.fonts.values().next().value : undefined,
    default_fonts,
    DISCONNECTED = 0,
    CONNECTING = 1,
    CONNECTED = 2,
    state = DISCONNECTED,
    messages = { 1: 'This client is connecting ...', 2: 'This client is already connnected.' },
    key_max_size = 16384,
    fields = ['hostname', 'port', 'username'],
    form_keys = fields.concat(['password', 'totp']),
    opts_keys = ['bgcolor', 'title', 'encoding', 'command', 'term', 'fontsize', 'fontcolor'],
    url_form_data = {},
    url_opts_data = {},
    validated_form_data,
    event_origin,
    hostname_tester = /((^\s*((([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]))\s*$)|(^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$))|(^\s*((?=.{1,255}$)(?=.*[A-Za-z].*)[0-9A-Za-z](?:(?:[0-9A-Za-z]|\b-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|\b-){0,61}[0-9A-Za-z])?)*)\s*$)/;


  function store_items(names, data) {
    var i, name, value;

    for (i = 0; i < names.length; i++) {
      name = names[i];
      value = data.get(name);
      if (value) {
        window.localStorage.setItem(name, value);
      }
    }
  }


  function restore_items(names) {
    var i, name, value;

    for (i = 0; i < names.length; i++) {
      name = names[i];
      value = window.localStorage.getItem(name);
      if (value) {
        $('#' + name).val(value);
      }
    }
  }


  function populate_form(data) {
    var names = form_keys.concat(['passphrase']),
      i, name;

    for (i = 0; i < names.length; i++) {
      name = names[i];
      $('#' + name).val(data.get(name));
    }
  }


  function get_object_length(object) {
    return Object.keys(object).length;
  }


  function decode_uri_component(uri) {
    try {
      return decodeURIComponent(uri);
    } catch (e) {
      console.error(e);
    }
    return '';
  }

  function decode_password(encoded) {
    try {
      return window.atob(encoded);
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  //#region

  // DES encrypt
  function encryptByDES(message, key) {
    var keyHex = CryptoJS.enc.Utf8.parse(key);
    var encrypted = CryptoJS.DES.encrypt(message, keyHex, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.ciphertext.toString();
  }

  // DES decrypt
  function decryptByDES(ciphertext, key) {
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

  // check the given_timestamp if it older than 3 minutes. interval: expired (seconds)
  function check_time_is_expired(given_timestamp, interval = 3 * 60) {
    let now = new Date().getTime(); // current time in milliseconds
    return (now - given_timestamp > interval * 1000);
  }

  function formatTimestamp(timestamp) {
    let date = new Date(timestamp);
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toString().padStart(2, "0");
    let day = date.getDate().toString().padStart(2, "0");
    let hours = date.getHours().toString().padStart(2, "0");
    let minutes = date.getMinutes().toString().padStart(2, "0");
    let seconds = date.getSeconds().toString().padStart(2, "0");
    let milliseconds = date.getMilliseconds().toString().padStart(3, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * 设置 localStoryage
   * @param key 键
   * @param value 值
   * @param expire 过期时间(秒) 缓存最大时间请勿超过 forceTime 否则每次都会清空数据 (未设置请忽略)
   * @return bool true
   */
  function cacheSet(key, value = '', expire = 0) {
    // 当前时间戳
    var nowTime = Math.ceil(Date.now() / 1000);
    // 设置数据
    localStorage.setItem(key, JSON.stringify(value))
    // 判断是否有过期时间
    if (expire > 0) {
      // 设置过期时间
      localStorage.setItem(key + '_expire', (nowTime + parseInt(expire)))
    }
    else {
      // 设置过期时间
      localStorage.setItem(key + '_expire', 0)
    }
    return true;
  }

  /**
   * 读取 localStoryage
   * @param key
   * @return bool|originData false|originData
   */
  function cacheGet(key, default_value = null) {
    // 当前时间戳
    var nowTime = Math.ceil(Date.now() / 1000);
    // 获取键时间戳
    var rawCacheDataExpire = localStorage.getItem(key + '_expire');
    var cacheDataExpire = parseInt(rawCacheDataExpire);

    // 强制过期时间 为0时忽略 用于解决缓存时间与本地时间差距过大(例本地更改了计算机时间)
    var forceTime = 3600;
    // 判断用户是否删除了过期时间 判断是否设置了过期时间 判断是否超过过期时间 判断当前计算机时间与设置的过期时间差距是否过大
    if ((rawCacheDataExpire === null) || (cacheDataExpire > 0) && ((nowTime > cacheDataExpire) || (forceTime > 0 && Math.abs(cacheDataExpire - nowTime) > forceTime))) {
      // 删除过期key
      localStorage.removeItem(key)
      // 删除过期时间
      localStorage.removeItem(key + '_expire')
      return default_value;
    }

    // 获取数据
    cacheData = JSON.parse(localStorage.getItem(key));

    if (cacheData === null || cacheData === false) {
      return default_value;
    }
    // 返回数据
    return cacheData;
  }

  /**
   * 判断密文是否使用过
   * @param key
   * @return bool|originData false|originData
   */
  function check_ciphertext_is_used(ciphertext) {
    return cacheGet(ciphertext) == 1;
  }


  //#endregion

  function parse_url_data(string, form_keys, opts_keys, form_map, opts_map) {

    var i, pair, key, val,
      arr = string.split('&');

    for (i = 0; i < arr.length; i++) {
      pair = arr[i].split('=');
      key = pair[0].trim().toLowerCase();
      val = pair.slice(1).join('=').trim();

      if (form_keys.indexOf(key) >= 0) {
        form_map[key] = val;
      } else if (opts_keys.indexOf(key) >= 0) {
        opts_map[key] = val;
      }
    }

    if (form_map.password) {
      form_map.password = decode_password(form_map.password);
    }


    var use_des_encrypt = true;
    if (use_des_encrypt) {
      /*
      # 提升安全性从两方面入手:
      
      1. 使用DES算法, 设置好密钥后, 对所有参数["hostname", "port", "username", "password"]进行加密.
      2. 由于是GET请求, 所以使用过的密文都必须报废. 思路如下:
        2.1 在构造密文时, 加入当前时间"time"
        2.2 客户端发送请求的时间与当前服务器时间相差不能超过3分钟
        2.3 缓存报废密文库, 保存最近5分钟使用过的密文
        2.4 先校验客户端请求的密文是否在缓存中, 如果在, 则报废
      3. 校验还得是服务端... 以上思路在服务端再次实现了一遍, 删除了前端的des校验..
      */
      var key= document.my_des_key;

      // --- convert current url's queryString to jsonData
      let queryString = window.location.search;
      // let currentPath = window.location.pathname;
      let urlParams = new URLSearchParams(queryString);
      let jsonData = {};
      for (let [key, value] of urlParams.entries()) {
        jsonData[key] = value;
      }

      var ciphertext = jsonData["ct"];
      if (ciphertext != null) {
        var _message_str = decryptByDES(ciphertext, key);
        var message = JSON.parse(_message_str);

        delete message['time'];

        for (let key in message) {
          val = message[key];

          if (form_keys.indexOf(key) >= 0) {
            form_map[key] = val;
          }
          else if (opts_keys.indexOf(key) >= 0) {
            opts_map[key] = val;
          }
        }

        return;
      }
    }

  }


  function parse_xterm_style() {
    var text = $('.xterm-helpers style').text();
    var arr = text.split('xterm-normal-char{width:');
    style.width = parseFloat(arr[1]);
    arr = text.split('div{height:');
    style.height = parseFloat(arr[1]);
  }


  function get_cell_size(term) {
    style.width = term._core._renderService._renderer.dimensions.actualCellWidth;
    style.height = term._core._renderService._renderer.dimensions.actualCellHeight;
  }


  function toggle_fullscreen(term) {
    $('#terminal .terminal').toggleClass('fullscreen');
    term.fitAddon.fit();
  }


  function current_geometry(term) {
    if (!style.width || !style.height) {
      try {
        get_cell_size(term);
      } catch (TypeError) {
        parse_xterm_style();
      }
    }

    var cols = parseInt(window.innerWidth / style.width, 10) - 1;
    var rows = parseInt(window.innerHeight / style.height, 10);
    return { 'cols': cols, 'rows': rows };
  }


  function resize_terminal(term) {
    var geometry = current_geometry(term);
    term.on_resize(geometry.cols, geometry.rows);
  }


  function set_backgound_color(term, color) {
    term.setOption('theme', {
      background: color
    });
  }

  function set_font_color(term, color) {
    term.setOption('theme', {
      foreground: color
    });
  }

  function custom_font_is_loaded() {
    if (!custom_font) {
      console.log('No custom font specified.');
    } else {
      console.log('Status of custom font ' + custom_font.family + ': ' + custom_font.status);
      if (custom_font.status === 'loaded') {
        return true;
      }
      if (custom_font.status === 'unloaded') {
        return false;
      }
    }
  }

  function update_font_family(term) {
    if (term.font_family_updated) {
      console.log('Already using custom font family');
      return;
    }

    if (!default_fonts) {
      default_fonts = term.getOption('fontFamily');
    }

    if (custom_font_is_loaded()) {
      var new_fonts = custom_font.family + ', ' + default_fonts;
      term.setOption('fontFamily', new_fonts);
      term.font_family_updated = true;
      console.log('Using custom font family ' + new_fonts);
    }
  }


  function reset_font_family(term) {
    if (!term.font_family_updated) {
      console.log('Already using default font family');
      return;
    }

    if (default_fonts) {
      term.setOption('fontFamily', default_fonts);
      term.font_family_updated = false;
      console.log('Using default font family ' + default_fonts);
    }
  }


  function format_geometry(cols, rows) {
    return JSON.stringify({ 'cols': cols, 'rows': rows });
  }


  function read_as_text_with_decoder(file, callback, decoder) {
    var reader = new window.FileReader();

    if (decoder === undefined) {
      decoder = new window.TextDecoder('utf-8', { 'fatal': true });
    }

    reader.onload = function () {
      var text;
      try {
        text = decoder.decode(reader.result);
      } catch (TypeError) {
        console.log('Decoding error happened.');
      } finally {
        if (callback) {
          callback(text);
        }
      }
    };

    reader.onerror = function (e) {
      console.error(e);
    };

    reader.readAsArrayBuffer(file);
  }


  function read_as_text_with_encoding(file, callback, encoding) {
    var reader = new window.FileReader();

    if (encoding === undefined) {
      encoding = 'utf-8';
    }

    reader.onload = function () {
      if (callback) {
        callback(reader.result);
      }
    };

    reader.onerror = function (e) {
      console.error(e);
    };

    reader.readAsText(file, encoding);
  }


  function read_file_as_text(file, callback, decoder) {
    if (!window.TextDecoder) {
      read_as_text_with_encoding(file, callback, decoder);
    } else {
      read_as_text_with_decoder(file, callback, decoder);
    }
  }


  function reset_wssh() {
    var name;

    for (name in wssh) {
      if (wssh.hasOwnProperty(name) && name !== 'connect') {
        delete wssh[name];
      }
    }
  }


  function log_status(text, to_populate) {
    console.log(text);
    status.html(text.split('\n').join('<br/>'));

    if (to_populate && validated_form_data) {
      populate_form(validated_form_data);
      validated_form_data = undefined;
    }

    if (waiter.css('display') !== 'none') {
      waiter.hide();
    }

    if (form_container.css('display') === 'none') {
      form_container.show();
    }
  }


  function ajax_complete_callback(resp) {
    button.prop('disabled', false);

    if (resp.status !== 200) {
      log_status(resp.status + ': ' + resp.statusText, true);
      state = DISCONNECTED;
      return;
    }

    var msg = resp.responseJSON;
    if (!msg.id) {
      log_status(msg.status, true);
      state = DISCONNECTED;
      return;
    }

    var ws_url = window.location.href.split(/\?|#/, 1)[0].replace('http', 'ws'),
      join = (ws_url[ws_url.length - 1] === '/' ? '' : '/'),
      url = ws_url + join + 'ws?id=' + msg.id,
      sock = new window.WebSocket(url),
      encoding = 'utf-8',
      decoder = window.TextDecoder ? new window.TextDecoder(encoding) : encoding,
      terminal = document.getElementById('terminal'),
      termOptions = {
        cursorBlink: true,
        theme: {
          background: url_opts_data.bgcolor || 'black',
          foreground: url_opts_data.fontcolor || 'white'
        }
      };

    if (url_opts_data.fontsize) {
      var fontsize = window.parseInt(url_opts_data.fontsize);
      if (fontsize && fontsize > 0) {
        termOptions.fontSize = fontsize;
      }
    }

    var term = new window.Terminal(termOptions);

    term.fitAddon = new window.FitAddon.FitAddon();
    term.loadAddon(term.fitAddon);

    console.log(url);
    if (!msg.encoding) {
      console.log('Unable to detect the default encoding of your server');
      msg.encoding = encoding;
    } else {
      console.log('The deault encoding of your server is ' + msg.encoding);
    }

    function term_write(text) {
      if (term) {
        term.write(text);
        if (!term.resized) {
          resize_terminal(term);
          term.resized = true;
        }
      }
    }

    function set_encoding(new_encoding) {
      // for console use
      if (!new_encoding) {
        console.log('An encoding is required');
        return;
      }

      if (!window.TextDecoder) {
        decoder = new_encoding;
        encoding = decoder;
        console.log('Set encoding to ' + encoding);
      } else {
        try {
          decoder = new window.TextDecoder(new_encoding);
          encoding = decoder.encoding;
          console.log('Set encoding to ' + encoding);
        } catch (RangeError) {
          console.log('Unknown encoding ' + new_encoding);
          return false;
        }
      }
    }

    wssh.set_encoding = set_encoding;

    if (url_opts_data.encoding) {
      if (set_encoding(url_opts_data.encoding) === false) {
        set_encoding(msg.encoding);
      }
    } else {
      set_encoding(msg.encoding);
    }


    wssh.geometry = function () {
      // for console use
      var geometry = current_geometry(term);
      console.log('Current window geometry: ' + JSON.stringify(geometry));
    };

    wssh.send = function (data) {
      // for console use
      if (!sock) {
        console.log('Websocket was already closed');
        return;
      }

      if (typeof data !== 'string') {
        console.log('Only string is allowed');
        return;
      }

      try {
        JSON.parse(data);
        sock.send(data);
      } catch (SyntaxError) {
        data = data.trim() + '\r';
        sock.send(JSON.stringify({ 'data': data }));
      }
    };

    wssh.reset_encoding = function () {
      // for console use
      if (encoding === msg.encoding) {
        console.log('Already reset to ' + msg.encoding);
      } else {
        set_encoding(msg.encoding);
      }
    };

    wssh.resize = function (cols, rows) {
      // for console use
      if (term === undefined) {
        console.log('Terminal was already destroryed');
        return;
      }

      var valid_args = false;

      if (cols > 0 && rows > 0) {
        var geometry = current_geometry(term);
        if (cols <= geometry.cols && rows <= geometry.rows) {
          valid_args = true;
        }
      }

      if (!valid_args) {
        console.log('Unable to resize terminal to geometry: ' + format_geometry(cols, rows));
      } else {
        term.on_resize(cols, rows);
      }
    };

    wssh.set_bgcolor = function (color) {
      set_backgound_color(term, color);
    };

    wssh.set_fontcolor = function (color) {
      set_font_color(term, color);
    };

    wssh.custom_font = function () {
      update_font_family(term);
    };

    wssh.default_font = function () {
      reset_font_family(term);
    };

    term.on_resize = function (cols, rows) {
      if (cols !== this.cols || rows !== this.rows) {
        console.log('Resizing terminal to geometry: ' + format_geometry(cols, rows));
        this.resize(cols, rows);
        sock.send(JSON.stringify({ 'resize': [cols, rows] }));
      }
    };

    term.onData(function (data) {
      // console.log(data);
      sock.send(JSON.stringify({ 'data': data }));
    });

    sock.onopen = function () {
      term.open(terminal);
      toggle_fullscreen(term);
      update_font_family(term);
      term.focus();
      state = CONNECTED;
      title_element.text = url_opts_data.title || default_title;
      if (url_opts_data.command) {
        setTimeout(function () {
          sock.send(JSON.stringify({ 'data': url_opts_data.command + '\r' }));
        }, 500);
      }
    };

    sock.onmessage = function (msg) {
      read_file_as_text(msg.data, term_write, decoder);
    };

    sock.onerror = function (e) {
      console.error(e);
    };

    sock.onclose = function (e) {
      console.log("~~~~~~~~~~~~ onclose");

      if (document.forbiddenindex){
        var msg = "SSH链接已关闭.";
        if (e.reason)
          msg += " reason: " + e.reason;
        document.body.innerHTML = msg;
        document.title = "Closed";
        return;
      }

      term.dispose();

      term = undefined;
      sock = undefined;
      reset_wssh();
      log_status(e.reason, true);
      state = DISCONNECTED;
      default_title = 'WebSSH';
      title_element.text = default_title;
    };

    $(window).resize(function () {
      if (term) {
        resize_terminal(term);
      }
    });
  }


  function wrap_object(opts) {
    var obj = {};

    obj.get = function (attr) {
      return opts[attr] || '';
    };

    obj.set = function (attr, val) {
      opts[attr] = val;
    };

    return obj;
  }


  function clean_data(data) {
    var i, attr, val;
    var attrs = form_keys.concat(['privatekey', 'passphrase']);

    for (i = 0; i < attrs.length; i++) {
      attr = attrs[i];
      val = data.get(attr);
      if (typeof val === 'string') {
        data.set(attr, val.trim());
      }
    }
  }


  function validate_form_data(data) {
    clean_data(data);

    var hostname = data.get('hostname'),
      port = data.get('port'),
      username = data.get('username'),
      pk = data.get('privatekey'),
      result = {
        valid: false,
        data: data,
        title: ''
      },
      errors = [], size;

    if (!hostname) {
      errors.push('Value of hostname is required.');
    } else {
      if (!hostname_tester.test(hostname)) {
        errors.push('Invalid hostname: ' + hostname);
      }
    }

    if (!port) {
      port = 22;
    } else {
      if (!(port > 0 && port <= 65535)) {
        errors.push('Invalid port: ' + port);
      }
    }

    if (!username) {
      errors.push('Value of username is required.');
    }

    if (pk) {
      size = pk.size || pk.length;
      if (size > key_max_size) {
        errors.push('Invalid private key: ' + pk.name || '');
      }
    }

    if (!errors.length || debug) {
      result.valid = true;
      result.title = username + '@' + hostname + ':' + port;
    }
    result.errors = errors;

    return result;
  }

  // Fix empty input file ajax submission error for safari 11.x
  function disable_file_inputs(inputs) {
    var i, input;

    for (i = 0; i < inputs.length; i++) {
      input = inputs[i];
      if (input.files.length === 0) {
        input.setAttribute('disabled', '');
      }
    }
  }


  function enable_file_inputs(inputs) {
    var i;

    for (i = 0; i < inputs.length; i++) {
      inputs[i].removeAttribute('disabled');
    }
  }


  function connect_without_options() {
    // use data from the form
    var form = document.querySelector(form_id),
      inputs = form.querySelectorAll('input[type="file"]'),
      url = form.action,
      data, pk;

    disable_file_inputs(inputs);
    data = new FormData(form);
    pk = data.get('privatekey');
    enable_file_inputs(inputs);

    function ajax_post() {
      status.text('');
      button.prop('disabled', true);

      $.ajax({
        url: url,
        type: 'post',
        data: data,
        complete: ajax_complete_callback,
        cache: false,
        contentType: false,
        processData: false
      });
    }

    var result = validate_form_data(data);
    if (!result.valid) {
      log_status(result.errors.join('\n'));
      return;
    }

    if (pk && pk.size && !debug) {
      read_file_as_text(pk, function (text) {
        if (text === undefined) {
          log_status('Invalid private key: ' + pk.name);
        } else {
          ajax_post();
        }
      });
    } else {
      ajax_post();
    }

    return result;
  }


  function connect_with_options(data) {
    // use data from the arguments
    var form = document.querySelector(form_id),
      url = data.url || form.action,
      _xsrf = form.querySelector('input[name="_xsrf"]');

    var result = validate_form_data(wrap_object(data));
    if (!result.valid) {
      log_status(result.errors.join('\n'));
      return;
    }

    data.term = term_type.val();
    data._xsrf = _xsrf.value;
    if (event_origin) {
      data._origin = event_origin;
    }

    status.text('');
    button.prop('disabled', true);

    $.ajax({
      url: url,
      type: 'post',
      data: data,
      complete: ajax_complete_callback
    });

    return result;
  }


  function connect(hostname, port, username, password, privatekey, passphrase, totp) {
    // for console use
    var result, opts;

    if (state !== DISCONNECTED) {
      console.log(messages[state]);
      return;
    }

    if (hostname === undefined) {
      result = connect_without_options();
    } else {
      if (typeof hostname === 'string') {
        opts = {
          hostname: hostname,
          port: port,
          username: username,
          password: password,
          privatekey: privatekey,
          passphrase: passphrase,
          totp: totp
        };
      } else {
        opts = hostname;
      }

      result = connect_with_options(opts);
    }

    if (result) {
      state = CONNECTING;
      default_title = result.title;
      if (hostname) {
        validated_form_data = result.data;
      }
      store_items(fields, result.data);
    }
  }

  wssh.connect = connect;

  $(form_id).submit(function (event) {
    event.preventDefault();
    connect();
  });


  function cross_origin_connect(event) {

    console.log(event.origin);
    var prop = 'connect',
      args;

    try {
      args = JSON.parse(event.data);
    } catch (SyntaxError) {
      args = event.data.split('|');
    }

    if (!Array.isArray(args)) {
      args = [args];
    }

    try {
      event_origin = event.origin;
      wssh[prop].apply(wssh, args);
    } finally {
      event_origin = undefined;
    }
  }

  window.addEventListener('message', cross_origin_connect, false);

  if (document.fonts) {
    document.fonts.ready.then(
      function () {
        if (custom_font_is_loaded() === false) {
          document.body.style.fontFamily = custom_font.family;
        }
      }
    );
  }


  parse_url_data(
    decode_uri_component(window.location.search.substring(1)) + '&' + decode_uri_component(window.location.hash.substring(1)),
    form_keys, opts_keys, url_form_data, url_opts_data
  );
  // console.log(url_form_data);
  // console.log(url_opts_data);

  if (url_opts_data.term) {
    term_type.val(url_opts_data.term);
  }

  if (url_form_data.password === null) {
    log_status('Password via url must be encoded in base64.');
  } else {
    if (get_object_length(url_form_data)) {
      waiter.show();
      connect(url_form_data);
    } else {
      restore_items(fields);
      form_container.show();
    }
  }

});
