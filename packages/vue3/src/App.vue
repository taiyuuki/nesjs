<script setup lang="ts">
import { ref } from 'vue'
import BaseEmu from './components/BaseEmu.vue'

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
    <main class="app-main">
      <div class="player-container">
        <BaseEmu
          ref="nesPlayer"
          rom="Super Mario Bros (JU).nes"
          :scale="3"
          :volume="70"
          :clip8px="false"
          :auto-start="true"
          :smoothing="false"
        />
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
