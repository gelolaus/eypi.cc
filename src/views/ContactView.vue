<template>
  <section class="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-28">
    <div class="mica-card relative w-full max-w-3xl rounded-3xl border border-gray-200 dark:border-slate-600 p-8 md:p-14">
      <!-- Corner screws -->
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <!-- Header -->
      <div class="mb-10 border-b border-gray-200 dark:border-slate-700 pb-8">
        <h1 class="font-mono text-2xl font-bold text-[#34418F] dark:text-slate-200 uppercase tracking-widest mb-1">
          Contact
        </h1>
        <p class="font-mono text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">
          Last Updated: May 16, 2026
        </p>
      </div>

      <div class="space-y-10 font-mono text-sm leading-relaxed">

        <!-- General Support -->
        <div>
          <h3 class="text-xs font-bold text-[#34418F] dark:text-slate-300 uppercase tracking-widest border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            General Support
          </h3>
          <p class="text-gray-600 dark:text-slate-400 mb-3">
            For inquiries, bug reports, or anything related to eypi.cc, reach out directly to the maintainer:
          </p>
          <a
            href="mailto:hello@gelolaus.com"
            class="font-bold text-[#34418F] dark:text-slate-200 hover:text-[#DEAC4B] dark:hover:text-[#DEAC4B] underline underline-offset-4 transition-colors"
            data-cursor="cta"
          >
            hello@gelolaus.com
          </a>
        </div>

        <!-- Build with Eypi -->
        <div>
          <h3 class="text-xs font-bold text-[#34418F] dark:text-slate-300 uppercase tracking-widest border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            Build with Eypi
          </h3>
          <p class="text-gray-600 dark:text-slate-400 mb-4">
            Are you an APC student, org officer, or faculty member with an idea that could benefit the broader college community? Eypi is open to collaboration.
          </p>
          <p class="text-gray-600 dark:text-slate-400 mb-4">
            Whether you want to build a personal project on top of the Eypi infrastructure, propose a new feature, or partner on a community tool — send an email <strong class="text-gray-800 dark:text-slate-200">from your APC-provided email address</strong> with the subject line <strong class="text-gray-800 dark:text-slate-200">"Build with Eypi"</strong>.
          </p>
          <a
            href="mailto:hello@gelolaus.com?subject=Build%20with%20Eypi"
            class="font-bold text-[#34418F] dark:text-slate-200 hover:text-[#DEAC4B] dark:hover:text-[#DEAC4B] underline underline-offset-4 transition-colors"
            data-cursor="cta"
          >
            hello@gelolaus.com
          </a>
        </div>

        <!-- What to Include -->
        <div>
          <h3 class="text-xs font-bold text-[#34418F] dark:text-slate-300 uppercase tracking-widest border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            What to Include
          </h3>
          <ul class="list-disc pl-5 space-y-2 text-gray-600 dark:text-slate-400">
            <li>Your organization, school, department, or role</li>
            <li>A brief description of the project or feature idea</li>
            <li>How it would serve the APC community</li>
          </ul>
        </div>

      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
</script>
