<template>
  <div class="dashboard-skeleton">
    <div class="skeleton-header">
      <div class="skeleton-line skeleton-title"></div>
      <div class="skeleton-line skeleton-subtitle"></div>
    </div>
    <div class="skeleton-grid">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
    <div class="skeleton-row">
      <div class="skeleton-panel"></div>
      <div class="skeleton-panel"></div>
    </div>
    <div class="skeleton-panel tall"></div>
  </div>
</template>

<style scoped>
.dashboard-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.skeleton-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-line {
  border-radius: 999px;
  background: rgba(90, 57, 39, 0.35);
  border: 1px solid rgba(90, 57, 39, 0.5);
  animation: pulse 1.6s ease-in-out infinite;
}

.skeleton-title {
  width: 240px;
  height: 18px;
}

.skeleton-subtitle {
  width: 320px;
  height: 12px;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.skeleton-card {
  height: 96px;
  border-radius: 16px;
  background: rgba(32, 19, 12, 0.7);
  border: 1px solid rgba(90, 57, 39, 0.5);
  animation: pulse 1.6s ease-in-out infinite;
}

.skeleton-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.skeleton-panel {
  height: 220px;
  border-radius: 18px;
  background: rgba(32, 19, 12, 0.7);
  border: 1px solid rgba(90, 57, 39, 0.5);
  animation: pulse 1.6s ease-in-out infinite;
}

.skeleton-panel.tall {
  height: 320px;
}

@keyframes pulse {
  0% {
    opacity: 0.55;
  }
  50% {
    opacity: 0.9;
  }
  100% {
    opacity: 0.55;
  }
}
</style>
