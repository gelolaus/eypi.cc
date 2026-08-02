<template>
  <section class="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-28">
    <Card className="relative w-full max-w-3xl">
      <div class="mb-10 border-b border-g-border pb-8">
        <h1 class="font-display text-3xl font-bold tracking-tight text-g-text">
          Privacy Policy
        </h1>
        <p class="mt-2 text-xs text-g-muted">
          Effective Date: March 1, 2026
        </p>
      </div>

      <div class="space-y-8 text-sm leading-relaxed">
        <p class="font-semibold text-g-text">
          Pursuant to the Data Privacy Act of 2012 (Republic Act No. 10173) of the Republic of the Philippines, this policy describes what data eypi.cc collects, how we store it, and who can access it.
        </p>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            1. Information Collection &amp; Storage
          </h3>
          <p class="text-g-muted mb-4">When you use eypi.cc, we collect and store the following:</p>
          <ul class="list-disc pl-5 space-y-2 text-g-muted">
            <li><strong class="text-g-text">Account credentials:</strong> Passwords are one-way hashed (e.g., bcrypt/Argon2) before storage. We do not store plaintext passwords.</li>
            <li><strong class="text-g-text">Link data:</strong> Email addresses and original destination URLs are stored in plaintext so redirects work when someone clicks your short link.</li>
            <li><strong class="text-g-text">Usage data:</strong> Click counts on your short links.</li>
          </ul>
        </div>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            2. Security Protocols &amp; User Liability
          </h3>
          <p class="text-g-muted">Because passwords are one-way hashed, they cannot be decrypted. The developers and maintainers of eypi.cc cannot view your password and will not attempt to access your account. Use a password manager and do not reuse credentials from other sites.</p>
        </div>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            3. Strict Access Controls
          </h3>
          <p class="text-g-muted">Access to the database is limited. Only the lead maintainer, <strong class="text-g-text">Angelo Laus</strong>, has direct database access. That access is used only for maintenance, troubleshooting, and keeping the service running.</p>
        </div>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            4. Data Sharing &amp; Disclosure
          </h3>
          <p class="text-g-muted mb-4">Your link data and personal information will <strong class="text-g-text">never</strong> be sold, distributed, or shared with other individuals or students for personal use. We disclose data only in these cases:</p>
          <ul class="list-disc pl-5 space-y-2 text-g-muted">
            <li><strong class="text-g-text">Institutional Requests:</strong> Official and verified inquiries from Asia Pacific College (APC).</li>
            <li><strong class="text-g-text">Legal Compliance:</strong> Subpoenas, warrants, or official requests from local Philippine law enforcement authorities.</li>
          </ul>
          <p class="mt-4 font-semibold text-g-destructive">
            Prior notification: If a local authority or Asia Pacific College requests access to your data, you will be notified before disclosure unless Philippine law prohibits it.
          </p>
        </div>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            5. Rights of the Data Subject
          </h3>
          <p class="text-g-muted">Under the Data Privacy Act of 2012, you have the right to be informed, object to processing, access your data, rectify inaccuracies, erase or block your data, and the right to data portability. To exercise these rights, <router-link to="/contact" class="text-g-brand underline transition-colors hover:text-g-primary">contact us</router-link>.</p>
        </div>
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import Card from '@/components/ui/Card.vue'
</script>
