<template>
  <div class="h-screen overflow-y-auto bg-[#E5E5E5] dark:bg-slate-950 text-gray-800 dark:text-slate-200 py-24 px-6 relative z-10">
    <div class="mx-auto w-full max-w-4xl bg-white dark:bg-mica-navy-card border border-gray-300 dark:border-slate-600 p-12 md:p-16 shadow-2xl relative dark:backdrop-blur-xl">
      <div class="absolute top-0 left-0 w-full h-2 bg-[#34418F]"></div>

      <div class="border-b-2 border-gray-200 dark:border-slate-600 pb-8 mb-12">
        <h1 class="font-mono text-3xl font-black text-[#34418F] dark:text-slate-200 uppercase tracking-widest mb-2">PRIVACY POLICY</h1>
        <p class="font-mono text-xs text-gray-500 dark:text-slate-400 uppercase tracking-widest">Effective Date: March 1, 2026</p>
      </div>

      <div class="font-mono text-sm leading-relaxed text-gray-700 dark:text-slate-300 text-justify space-y-8">
        <p class="font-bold text-gray-900 dark:text-slate-200">
          Pursuant to the Data Privacy Act of 2012 (Republic Act No. 10173) of the Republic of the Philippines, eypi.cc is committed to protecting the personal information of our users. This document outlines our data collection, storage, and access protocols.
        </p>

        <div>
          <h3 class="text-lg font-bold text-[#34418F] dark:text-slate-200 mb-3 uppercase tracking-wider border-b border-gray-100 dark:border-slate-600 pb-2">1. Information Collection & Storage</h3>
          <p class="mb-4">When you utilize the eypi.cc routing engine, we collect and store the following data parameters:</p>
          <ul class="list-disc pl-5 space-y-2">
            <li><strong>Account Credentials:</strong> User passwords are cryptographically one-way hashed using industry-standard algorithms (e.g., bcrypt/Argon2) prior to database storage. We do not store plaintext passwords.</li>
            <li><strong>Routing Data:</strong> Email addresses and original destination URLs (long links) are stored in plaintext strictly to facilitate rapid routing resolution.</li>
            <li><strong>Telemetry:</strong> Basic interaction data, such as click counts on generated links.</li>
          </ul>
        </div>

        <div>
          <h3 class="text-lg font-bold text-[#34418F] dark:text-slate-200 mb-3 uppercase tracking-wider border-b border-gray-100 dark:border-slate-600 pb-2">2. Security Protocols & User Liability</h3>
          <p class="mb-4">Because passwords are one-way hashed, they cannot be decrypted. The developers and maintainers of eypi.cc physically cannot view your password, nor will they ever attempt to access your account. However, as a foundational security practice, we strongly advise users to utilize a reputable password manager to ensure they are not reusing credentials from other platforms.</p>
        </div>

        <div>
          <h3 class="text-lg font-bold text-[#34418F] dark:text-slate-200 mb-3 uppercase tracking-wider border-b border-gray-100 dark:border-slate-600 pb-2">3. Strict Access Controls</h3>
          <p class="mb-4">Access to the raw database is strictly compartmentalized. Only the lead maintainer, <strong>Angelo Laus</strong>, possesses administrative clearance to access the database infrastructure. This access is utilized solely for critical system maintenance, troubleshooting, and ensuring the operational integrity of the routing engine.</p>
        </div>

        <div>
          <h3 class="text-lg font-bold text-[#34418F] dark:text-slate-200 mb-3 uppercase tracking-wider border-b border-gray-100 dark:border-slate-600 pb-2">4. Data Sharing & Disclosure</h3>
          <p class="mb-4">Your routing data and personal information will <strong>never</strong> be sold, distributed, or provided to other individuals or students for personal use. We enforce a strict non-disclosure policy with the following specific exceptions:</p>
          <ul class="list-disc pl-5 space-y-2">
            <li><strong>Institutional Requests:</strong> Official and verified inquiries from Asia Pacific College (APC).</li>
            <li><strong>Legal Compliance:</strong> Subpoenas, warrants, or official requests from local Philippine law enforcement authorities.</li>
          </ul>
          <p class="mt-4 font-bold text-red-600 dark:text-red-400">
            Prior Notification Protocol: Should a local authority or Asia Pacific College explicitly request access to your data, you will be formally notified prior to the disclosure, provided that such notification is not prohibited by Philippine law.
          </p>
        </div>

        <div>
          <h3 class="text-lg font-bold text-[#34418F] dark:text-slate-200 mb-3 uppercase tracking-wider border-b border-gray-100 dark:border-slate-600 pb-2">5. Rights of the Data Subject</h3>
          <p class="mb-4">Under the Data Privacy Act of 2012, you hold the right to be informed, object to processing, access your data, rectify inaccuracies, erase or block your data, and the right to data portability. To exercise these rights, please contact our administrative team.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
