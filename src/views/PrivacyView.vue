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
          Privacy Policy
        </h1>
        <p class="font-mono text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">
          Effective Date: March 1, 2026
        </p>
      </div>

      <div class="space-y-8 font-mono text-sm leading-relaxed">

        <p class="font-bold text-gray-800 dark:text-slate-200">
          Pursuant to the Data Privacy Act of 2012 (Republic Act No. 10173) of the Republic of the Philippines, eypi.cc is committed to protecting the personal information of our users. This document outlines our data collection, storage, and access protocols.
        </p>

        <div>
          <h3 class="text-xs font-bold text-[#34418F] dark:text-slate-300 uppercase tracking-widest border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            1. Information Collection &amp; Storage
          </h3>
          <p class="text-gray-600 dark:text-slate-400 mb-4">When you utilize the eypi.cc routing engine, we collect and store the following data parameters:</p>
          <ul class="list-disc pl-5 space-y-2 text-gray-600 dark:text-slate-400">
            <li><strong class="text-gray-800 dark:text-slate-200">Account Credentials:</strong> User passwords are cryptographically one-way hashed using industry-standard algorithms (e.g., bcrypt/Argon2) prior to database storage. We do not store plaintext passwords.</li>
            <li><strong class="text-gray-800 dark:text-slate-200">Routing Data:</strong> Email addresses and original destination URLs (long links) are stored in plaintext strictly to facilitate rapid routing resolution.</li>
            <li><strong class="text-gray-800 dark:text-slate-200">Telemetry:</strong> Basic interaction data, such as click counts on generated links.</li>
          </ul>
        </div>

        <div>
          <h3 class="text-xs font-bold text-[#34418F] dark:text-slate-300 uppercase tracking-widest border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            2. Security Protocols &amp; User Liability
          </h3>
          <p class="text-gray-600 dark:text-slate-400">Because passwords are one-way hashed, they cannot be decrypted. The developers and maintainers of eypi.cc physically cannot view your password, nor will they ever attempt to access your account. However, as a foundational security practice, we strongly advise users to utilize a reputable password manager to ensure they are not reusing credentials from other platforms.</p>
        </div>

        <div>
          <h3 class="text-xs font-bold text-[#34418F] dark:text-slate-300 uppercase tracking-widest border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            3. Strict Access Controls
          </h3>
          <p class="text-gray-600 dark:text-slate-400">Access to the raw database is strictly compartmentalized. Only the lead maintainer, <strong class="text-gray-800 dark:text-slate-200">Angelo Laus</strong>, possesses administrative clearance to access the database infrastructure. This access is utilized solely for critical system maintenance, troubleshooting, and ensuring the operational integrity of the routing engine.</p>
        </div>

        <div>
          <h3 class="text-xs font-bold text-[#34418F] dark:text-slate-300 uppercase tracking-widest border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            4. Data Sharing &amp; Disclosure
          </h3>
          <p class="text-gray-600 dark:text-slate-400 mb-4">Your routing data and personal information will <strong class="text-gray-800 dark:text-slate-200">never</strong> be sold, distributed, or provided to other individuals or students for personal use. We enforce a strict non-disclosure policy with the following specific exceptions:</p>
          <ul class="list-disc pl-5 space-y-2 text-gray-600 dark:text-slate-400">
            <li><strong class="text-gray-800 dark:text-slate-200">Institutional Requests:</strong> Official and verified inquiries from Asia Pacific College (APC).</li>
            <li><strong class="text-gray-800 dark:text-slate-200">Legal Compliance:</strong> Subpoenas, warrants, or official requests from local Philippine law enforcement authorities.</li>
          </ul>
          <p class="mt-4 font-bold text-red-600 dark:text-red-400">
            Prior Notification Protocol: Should a local authority or Asia Pacific College explicitly request access to your data, you will be formally notified prior to the disclosure, provided that such notification is not prohibited by Philippine law.
          </p>
        </div>

        <div>
          <h3 class="text-xs font-bold text-[#34418F] dark:text-slate-300 uppercase tracking-widest border-b border-gray-200 dark:border-slate-700 pb-2 mb-4">
            5. Rights of the Data Subject
          </h3>
          <p class="text-gray-600 dark:text-slate-400">Under the Data Privacy Act of 2012, you hold the right to be informed, object to processing, access your data, rectify inaccuracies, erase or block your data, and the right to data portability. To exercise these rights, please <router-link to="/contact" class="text-[#34418F] dark:text-slate-300 hover:text-[#DEAC4B] underline transition-colors">contact our administrative team</router-link>.</p>
        </div>

      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
</script>
