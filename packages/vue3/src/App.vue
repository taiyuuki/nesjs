<script setup lang="ts">
import { ref } from 'vue'
import NesVue from './components/NesVue.vue'

const nesPlayer = ref()

function handleFullscreen() {
    const player = nesPlayer.value?.$el
    if (player) {
        if (document.fullscreenElement) {
            document.exitFullscreen()
        }
        else {
            player.requestFullscreen()
        }
    }
}

function handleReset() {
    nesPlayer.value?.reset()
}

function handleScreenshot() {
    nesPlayer.value?.screenshot(true)
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>🎮 NES Emulator - Video Player Style</h1>
      <p>现代化的 NES 模拟器，具备视频播放器风格的控制界面</p>
    </header>

    <main class="app-main">
      <div class="player-container">
        <NesVue
          ref="nesPlayer"
          rom="Super Mario Bros (JU).nes"
          :scale="3"
          :volume="70"
          :clip8px="true"
        />
        
        <div class="external-controls">
          <button 
            class="control-btn" 
            @click="handleFullscreen"
          >
            🖥️ 全屏
          </button>
          <button 
            class="control-btn" 
            @click="handleReset"
          >
            🔄 重置
          </button>
          <button 
            class="control-btn" 
            @click="handleScreenshot"
          >
            📷 截图
          </button>
        </div>
      </div>

      <div class="info-panel">
        <h3>功能特点</h3>
        <ul>
          <li>🎮 完整的 NES 模拟器功能</li>
          <li>🎨 现代化视频播放器风格界面</li>
          <li>🔊 音量控制和状态显示</li>
          <li>💾 存档/读档功能</li>
          <li>📷 游戏截图功能</li>
          <li>📱 响应式设计</li>
          <li>⌨️ 键盘和手柄支持</li>
        </ul>

        <h3>控制说明</h3>
        <ul>
          <li>▶️ 播放/暂停: 开始或暂停游戏</li>
          <li>⏹️ 停止: 停止游戏运行</li>
          <li>🔄 重置: 重新启动游戏</li>
          <li>🔊 音量: 调节游戏音量</li>
          <li>💾 存档: 下载游戏存档文件</li>
          <li>📁 读档: 加载之前的存档</li>
          <li>📷 截图: 保存游戏画面</li>
        </ul>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-header {
  text-align: center;
  color: white;
  margin-bottom: 40px;
}

.app-header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.app-header p {
  font-size: 1.2rem;
  opacity: 0.9;
  margin: 0;
}

.app-main {
  display: flex;
  gap: 40px;
  max-width: 1200px;
  margin: 0 auto;
  align-items: flex-start;
}

.player-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.external-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.control-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  font-size: 14px;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.info-panel {
  flex: 0 0 300px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  color: white;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.info-panel h3 {
  margin-top: 0;
  margin-bottom: 12px;
  color: #fff;
  font-size: 1.2rem;
}

.info-panel ul {
  margin: 0;
  padding-left: 20px;
}

.info-panel li {
  margin-bottom: 6px;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .app-main {
    flex-direction: column;
    gap: 30px;
  }

  .info-panel {
    flex: none;
  }

  .app-header h1 {
    font-size: 2rem;
  }

  .app-header p {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .app {
    padding: 16px;
  }

  .external-controls {
    gap: 8px;
  }

  .control-btn {
    padding: 6px 12px;
    font-size: 12px;
  }
}
</style>
