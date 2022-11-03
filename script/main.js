const { Realtime, TextMessage } = AV

function start() {
  const App = new Vue({
    el: '#app',
    template: '#template',
    data: {
      videoList: [],
      //默认加载的视频
      videoSrc: '',
      playing: false,
      //artplayer实例
      art: null,
      //初始化属性
      artPlyaer: {
        container: '.artplayer-app',
        url: 'https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8',
        pip: true,
        setting: true,
        flip: true,
        playbackRate: true,
        aspectRatio: true,
        fullscreen: true,
        fullscreenWeb: true,
        miniProgressBar: true,
        playsInline: true,
        airplay: true,
        theme: '#23ade5',
        moreVideoAttr: {
          crossOrigin: 'anonymous'
        },
        customType: {
          m3u8: async function (video, url) {
            // 切换地址前，要销毁上一个解码器实例
            if (this.hls) {
              this.hls.destroy()
            }
            this.hls = new Hls()
            this.hls.loadSource(url)
            this.hls.attachMedia(video)
          },
          flv: function (video, url) {
            if (flvjs.isSupported()) {
              const flvPlayer = flvjs.createPlayer({
                type: 'flv',
                url: url
              })
              flvPlayer.attachMediaElement(video)
              flvPlayer.load()
            } else {
              this.art.notice.show = '不支持播放格式：flv'
            }
          }
        }
      },
      //通讯使用
      controlParam: {
        user: '',
        action: '',
        time: '',
        url: ''
      },
      userId: '',

      /* leancloud-realtime 添加以下变量，appId、appKey、server这几个值去leancloud控制台>设置>应用凭证里面找 */
      chatRoom: null,
      appId: '****',
      appKey: '****',
      server: '****' // REST API 服务器地址
    },
    methods: {
      randomString(length) {
        let str = ''
        for (let i = 0; i < length; i++) {
          str += Math.random().toString(36).substr(2)
        }
        return str.substr(0, length)
      },
      addVideo() {
        if (this.videoSrc) {
          this.videoList.push(decodeURI(this.videoSrc))
        }
        localStorage.setItem('videoList', JSON.stringify(this.videoList))
      },
      playVideoItem(src) {
        //切换播放
        this.art.switchUrl(src)
        //通知切换视频
        this.controlParam.action = 'switch'
        this.controlParam.url = src
        this.sendMessage(this.controlParam)
        localStorage.setItem('currentPlayVideo', src)
      },
      deleteVideoItem(index) {
        this.videoList.splice(index, 1)
        localStorage.setItem('videoList', JSON.stringify(this.videoList))
      },
      playVideo() {
        if (this.playing) {
          this.art.pause()
          this.controlParam.action = 'pause'
          this.controlParam.time = this.art.currentTime
          this.sendMessage(this.controlParam)
        } else {
          this.art.play()
          this.controlParam.action = 'play'
          this.controlParam.time = this.art.currentTime
          this.sendMessage(this.controlParam)
        }
      },
      seekVideo() {
        //跳转视频
        this.art.pause()
        this.controlParam.action = 'seek'
        this.controlParam.time = this.art.currentTime
        this.sendMessage(this.controlParam)
      },
      sendMessage(controlParam) {
        //发送信息
        const params = JSON.stringify(controlParam)
        this.chatRoom.send(new TextMessage(params))
      },
      resultHandler(result) {
        //执行对应的操作
        switch (result.action) {
          case 'play':
            this.art.currentTime = result.time + 0.2 //播放时+0.2秒，抵消网络延迟
            this.art.play()
            break
          case 'pause':
            this.art.currentTime = result.time
            this.art.pause()
            break
          case 'seek':
            this.art.currentTime = result.time
            //跳转后等待同步继续视频
            this.art.pause()
            break
          case 'switch':
            this.art.switchUrl(result.url)
            break
        }
      },
      // 获取 url 参数
      getParam(variable) {
        var query = window.location.search.substring(1)
        var vars = query.split('&')
        for (var i = 0; i < vars.length; i++) {
          var pair = vars[i].split('=')
          if (pair[0] == variable) {
            return pair[1]
          }
        }
        return false
      },
      // 设置 url 参数
      setParam(param, val) {
        var stateObject = 0
        var title = '0'
        var oUrl = window.location.href.toString()
        var nUrl = ''
        var pattern = param + '=([^&]*)'
        var replaceText = param + '=' + val
        if (oUrl.match(pattern)) {
          var tmp = '/(' + param + '=)([^&]*)/gi'
          tmp = oUrl.replace(eval(tmp), replaceText)
          nUrl = tmp
        } else {
          if (oUrl.match('[?]')) {
            nUrl = oUrl + '&' + replaceText
          } else {
            nUrl = oUrl + '?' + replaceText
          }
        }
        history.replaceState(stateObject, title, nUrl)
      }
    },
    created() {
      /* 读取本地视频列表和上一次播放的视频*/
      const localList = JSON.parse(localStorage.getItem('videoList'))
      this.videoList = localList ? localList : []
      //用户id = 随机10位字母
      this.userId = this.randomString(10)
      this.controlParam.user = this.userId
    },
    mounted() {
      //实例化artplayer
      this.art = new Artplayer(this.artPlyaer)

      const that = this

      const realtime = new Realtime({
        appId: this.appId,
        appKey: this.appKey,
        server: this.server
      })

      //换成你自己的一个房间的 conversation id（这是服务器端生成的），第一次执行代码就会生成，在leancloud控制台>即时通讯>对话下面，复制一个过来即可

      var roomId = this.getParam('id') ? this.getParam('id') : '***********'

      // 每个客户端自定义的 id

      var client, room

      realtime
        .createIMClient(this.userId)
        .then(function (c) {
          console.log('连接成功')
          client = c
          client.on('disconnect', function () {
            console.log('[disconnect] 服务器连接已断开')
          })
          client.on('offline', function () {
            console.log('[offline] 离线（网络连接已断开）')
          })
          client.on('online', function () {
            console.log('[online] 已恢复在线')
          })
          client.on('schedule', function (attempt, time) {
            console.log('[schedule] ' + time / 1000 + 's 后进行第 ' + (attempt + 1) + ' 次重连')
          })
          client.on('retry', function (attempt) {
            console.log('[retry] 正在进行第 ' + (attempt + 1) + ' 次重连')
          })
          client.on('reconnect', function () {
            console.log('[reconnect] 重连成功')
          })
          client.on('reconnecterror', function () {
            console.log('[reconnecterror] 重连失败')
          })
          // 获取对话
          return c.getConversation(roomId)
        })
        .then(function (conversation) {
          if (conversation) {
            return conversation
          } else {
            // 如果服务器端不存在这个 conversation
            console.log('不存在这个 conversation，创建一个。')
            return client
              .createConversation({
                name: 'LeanCloud-Conversation',
                // 创建暂态的聊天室（暂态聊天室支持无限人员聊天）
                transient: true
              })
              .then(function (conversation) {
                roomId = conversation.id
                console.log('创建新 Room 成功，id 是：', roomId)
                that.setParam('id', roomId)
                return conversation
              })
          }
        })
        .then(function (conversation) {
          return conversation.join()
        })
        .then(function (conversation) {
          // 获取聊天历史
          room = conversation
          that.chatRoom = conversation
          // 房间接受消息
          room.on('message', function (message) {
            const result = JSON.parse(message._lctext)
            that.resultHandler(result)
          })
        })
        .catch(function (err) {
          console.error(err)
          console.log('错误：' + err.message)
        })

      //绑定事件
      this.art.on('play', () => {
        this.playing = true
      })
      this.art.on('pause', () => {
        this.playing = false
      })
      this.art.on('seek', () => {
        //跳转时间
        this.seekVideo()
        //等待1秒后自动播放
        setTimeout(() => {
          this.playVideo()
        }, 1000)
      })
    }
  })
}
