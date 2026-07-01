<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-24"
  >
    <div
      class="mica-card relative w-full max-w-md rounded-3xl border border-gray-200 dark:border-slate-600 p-8"
    >
      <!-- Corner screws -->
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <!-- Header -->
      <h2 class="mb-2 text-center font-mono text-xl font-bold text-[#34418F] dark:text-slate-200">
        RESET PASSWORD
      </h2>
      <p class="mb-6 text-center font-mono text-xs font-bold uppercase tracking-wider text-[#DEAC4B] dark:text-eypi-gold-dark">
        Coming soon
      </p>
      <p class="mb-6 text-center font-mono text-xs leading-relaxed text-gray-500 dark:text-slate-400">
        Self-service password recovery is not available yet.
      </p>

      <div class="mb-8 space-y-4 font-mono text-xs leading-relaxed text-gray-600 dark:text-slate-400">
        <p>
          If you are already signed in, you can update your password from
          <router-link
            to="/settings"
            class="text-[#34418F] underline transition-colors hover:text-[#DEAC4B] dark:text-slate-200 dark:hover:text-eypi-gold-dark"
          >
            Settings
          </router-link>.
        </p>
        <p>
          For account access issues, contact the admin via the
          <router-link
            to="/contact"
            class="text-[#34418F] underline transition-colors hover:text-[#DEAC4B] dark:text-slate-200 dark:hover:text-eypi-gold-dark"
          >
            Contact
          </router-link>
          page.
        </p>
      </div>

      <router-link
        to="/login"
        class="block text-center font-mono text-xs text-gray-500 transition-colors hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200"
        data-cursor="nav"
      >
        ← Back to Login
      </router-link>
    </div>
  </section>
</template>
