<template>
  <section class="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-28">
    <Card className="relative w-full max-w-3xl">
      <div class="mb-10 border-b border-g-border pb-8">
        <h1 class="font-display text-3xl font-bold tracking-tight text-g-text">
          Terms of Service
        </h1>
        <p class="mt-2 text-xs text-g-muted">
          Effective Date: March 1, 2026
        </p>
      </div>

      <div class="space-y-8 text-sm leading-relaxed">
        <p class="font-semibold text-g-text">
          By using eypi.cc, you agree to these Terms of Service. If you do not agree, stop using the service.
        </p>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            1. Acceptable Use Policy
          </h3>
          <p class="text-g-muted mb-4">eypi.cc is a link shortener and org toolkit for APC students. You agree that you will <strong class="text-g-text">not</strong> use the service to create short links that direct users to:</p>
          <ul class="list-disc pl-5 space-y-2 text-g-muted">
            <li>Malware, ransomware, or any malicious software infrastructure.</li>
            <li>Phishing sites or pages designed to steal credentials.</li>
            <li>Content that violates the laws of the Republic of the Philippines.</li>
            <li>Material that infringes upon the intellectual property rights of others.</li>
          </ul>
        </div>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            2. Service Modification &amp; Termination
          </h3>
          <p class="text-g-muted">We may review link usage data. The lead maintainer, Angelo Laus, may disable or delete any link or user account that violates this Acceptable Use Policy, without prior notice or liability.</p>
        </div>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            3. Disclaimer of Warranties
          </h3>
          <p class="text-g-muted">The eypi.cc service is provided on an <strong class="text-g-text">"AS-IS"</strong> and <strong class="text-g-text">"AS-AVAILABLE"</strong> basis. We make no guarantees regarding server uptime, redirect speed, or the continuous availability of your links. We disclaim all warranties, whether express or implied, including fitness for a particular commercial purpose.</p>
        </div>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            4. Limitation of Liability
          </h3>
          <p class="text-g-muted">Under no circumstances shall the developer (Angelo Laus), Asia Pacific College (APC), or any associated maintainers be held liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use the eypi.cc service. This includes, but is not limited to, lost web traffic, lost revenue, or data corruption.</p>
        </div>

        <div>
          <h3 class="text-card-title border-b border-g-border pb-2 mb-4">
            5. Governing Law
          </h3>
          <p class="text-g-muted">These Terms of Service shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the competent courts in Metro Manila.</p>
        </div>
      </div>
    </Card>
  </section>
</template>

<script setup lang="ts">
import Card from '@/components/ui/Card.vue'
</script>
