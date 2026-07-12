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
        <h1 class="text-section-title mb-1">
          Privacy Policy
        </h1>
        <p class="text-data text-xs text-gray-500 dark:text-slate-400">
          Effective Date: March 1, 2026
        </p>
      </div>

      <div class="space-y-8 text-sm leading-relaxed">

        <p class="font-bold text-gray-800 dark:text-slate-200">
          Pursuant to the Data Privacy Act of 2012 (Republic Act No. 10173) of the Republic of the Philippines, this policy describes what data eypi.cc collects, how we store it, and who can access it.
        </p>

        <div>
          <h3 class="text-card-title border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            1. Information Collection &amp; Storage
          </h3>
          <p class="text-gray-600 dark:text-slate-400 mb-4">When you use eypi.cc, we collect and store the following:</p>
          <ul class="list-disc pl-5 space-y-2 text-gray-600 dark:text-slate-400">
            <li><strong class="text-gray-800 dark:text-slate-200">Account credentials:</strong> Passwords are one-way hashed (e.g., bcrypt/Argon2) before storage. We do not store plaintext passwords.</li>
            <li><strong class="text-gray-800 dark:text-slate-200">Link data:</strong> Email addresses and original destination URLs are stored in plaintext so redirects work when someone clicks your short link.</li>
            <li><strong class="text-gray-800 dark:text-slate-200">Usage data:</strong> Click counts on your short links.</li>
          </ul>
        </div>

        <div>
          <h3 class="text-card-title border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            2. Security Protocols &amp; User Liability
          </h3>
          <p class="text-gray-600 dark:text-slate-400">Because passwords are one-way hashed, they cannot be decrypted. The developers and maintainers of eypi.cc cannot view your password and will not attempt to access your account. Use a password manager and do not reuse credentials from other sites.</p>
        </div>

        <div>
          <h3 class="text-card-title border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            3. Strict Access Controls
          </h3>
          <p class="text-gray-600 dark:text-slate-400">Access to the database is limited. Only the lead maintainer, <strong class="text-gray-800 dark:text-slate-200">Angelo Laus</strong>, has direct database access. That access is used only for maintenance, troubleshooting, and keeping the service running.</p>
        </div>

        <div>
          <h3 class="text-card-title border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            4. Data Sharing &amp; Disclosure
          </h3>
          <p class="text-gray-600 dark:text-slate-400 mb-4">Your link data and personal information will <strong class="text-gray-800 dark:text-slate-200">never</strong> be sold, distributed, or shared with other individuals or students for personal use. We disclose data only in these cases:</p>
          <ul class="list-disc pl-5 space-y-2 text-gray-600 dark:text-slate-400">
            <li><strong class="text-gray-800 dark:text-slate-200">Institutional Requests:</strong> Official and verified inquiries from Asia Pacific College (APC).</li>
            <li><strong class="text-gray-800 dark:text-slate-200">Legal Compliance:</strong> Subpoenas, warrants, or official requests from local Philippine law enforcement authorities.</li>
          </ul>
          <p class="mt-4 font-bold text-red-600 dark:text-red-400">
            Prior notification: If a local authority or Asia Pacific College requests access to your data, you will be notified before disclosure unless Philippine law prohibits it.
          </p>
        </div>

        <div>
          <h3 class="text-card-title border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            5. Rights of the Data Subject
          </h3>
          <p class="text-gray-600 dark:text-slate-400">Under the Data Privacy Act of 2012, you have the right to be informed, object to processing, access your data, rectify inaccuracies, erase or block your data, and the right to data portability. To exercise these rights, <router-link to="/contact" class="text-[#34418F] dark:text-slate-300 hover:text-[#DEAC4B] underline transition-colors">contact us</router-link>.</p>
        </div>

      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
</script>
