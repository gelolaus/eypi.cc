<template>
  <footer id="footer" data-section class="footer-dark bg-dot-grid-dark">
    <div class="footer-inner">

      <!-- Heading -->
      <h2 class="footer-heading">Build with<br />Eypi.</h2>

      <!-- Full-width stacked link rows -->
      <nav class="footer-links-full" aria-label="Footer navigation">
        <router-link to="/contact" class="footer-link-row" data-cursor="nav">
          <span>Contact</span>
          <span class="footer-arrow">↗</span>
        </router-link>
        <router-link to="/privacy" class="footer-link-row" data-cursor="nav">
          <span>Privacy</span>
          <span class="footer-arrow">↗</span>
        </router-link>
        <router-link to="/terms" class="footer-link-row" data-cursor="nav">
          <span>Terms</span>
          <span class="footer-arrow">↗</span>
        </router-link>
        <a
          href="https://gelolaus.com"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link-row"
          data-cursor="nav"
        >
          <span>Creator: gelolaus.com</span>
          <span class="footer-arrow">↗</span>
        </a>
      </nav>

      <!-- Bottom bar -->
      <div class="footer-bottom">
        <span class="footer-label">EYPI.CC</span>
        <span class="footer-year">ANGELO LAUS · {{ currentYear }}</span>
      </div>

    </div>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>
