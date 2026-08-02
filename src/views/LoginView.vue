<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-24"
  >
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_70%)]"
    />

    <Card className="relative w-full max-w-md">
      <h1 class="mb-6 font-display text-2xl font-bold tracking-tight text-g-text">
        {{ mode === 'login' ? 'Welcome back' : 'Create account' }}
      </h1>

      <Tabs v-model="mode" :tabs="authTabs" className="mb-6" />

      <form @submit.prevent="onSubmit" class="flex flex-col gap-4">
        <div v-if="mode === 'register'">
          <Input
            :value="name"
            type="text"
            placeholder="Full Name"
            autocomplete="name"
            :aria-invalid="Boolean(errors.name)"
            :aria-describedby="errors.name ? 'name-error' : undefined"
            @input="onNameInput"
          />
          <p v-if="errors.name" id="name-error" class="mt-1.5 text-sm text-g-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div>
          <Input
            :value="email"
            type="email"
            placeholder="Email"
            autocomplete="email"
            :aria-invalid="Boolean(errors.email)"
            :aria-describedby="errors.email ? 'email-error' : undefined"
            @input="onEmailInput"
          />
          <p v-if="errors.email" id="email-error" class="mt-1.5 text-sm text-g-destructive">
            {{ errors.email }}
          </p>
        </div>

        <div>
          <Input
            :value="password"
            type="password"
            placeholder="Password"
            autocomplete="current-password"
            :aria-invalid="Boolean(errors.password)"
            :aria-describedby="errors.password ? 'password-error' : undefined"
            @input="onPasswordInput"
          />
          <p v-if="errors.password" id="password-error" class="mt-1.5 text-sm text-g-destructive">
            {{ errors.password }}
          </p>
        </div>

        <Button type="submit" className="w-full" :disabled="isAuthenticating">
          {{ isAuthenticating ? 'Processing...' : mode === 'login' ? 'Login' : 'Register' }}
        </Button>

        <router-link
          v-if="mode === 'login'"
          to="/reset-password"
          class="text-center text-sm text-g-muted transition-colors hover:text-g-text"
        >
          Need password help?
        </router-link>
      </form>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, inject, onMounted, watch, type Ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { API_BASE_URL } from '@/config/api'
import type AppTransition from '@/components/AppTransition.vue'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Tabs from '@/components/ui/Tabs.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const dialog = useDialog()
const appTransition = inject<Ref<InstanceType<typeof AppTransition> | null>>('appTransition')

const authTabs = [
  { id: 'login', label: 'Login' },
  { id: 'register', label: 'Register' },
]

const mode = ref('login')
const name = ref('')
const email = ref('')
const password = ref('')
const isAuthenticating = ref(false)
const errors = reactive({ name: '', email: '', password: '' })

function onNameInput(e: Event) {
  name.value = (e.target as HTMLInputElement).value
}
function onEmailInput(e: Event) {
  email.value = (e.target as HTMLInputElement).value
}
function onPasswordInput(e: Event) {
  password.value = (e.target as HTMLInputElement).value
}

watch(name, () => { errors.name = '' })
watch(email, () => { errors.email = '' })
watch(password, () => { errors.password = '' })

watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab === 'register') {
      mode.value = 'register'
    } else {
      mode.value = 'login'
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (route.query.verified === 'true') {
    toast.success('Email verified. You can now log in.')
    router.replace({ path: '/login', query: {} })
  }
})

const handleLogin = async () => {
  if (!email.value.trim() || !email.value.includes('@')) {
    errors.email = 'Enter a valid email address.'
    return
  }
  if (password.value.length < 8) {
    errors.password = 'Enter a password with at least 8 characters.'
    return
  }
  isAuthenticating.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Authentication failed')
    }

    localStorage.setItem('eypi_token', data.token)
    // Verify token is stored before navigation so the route guard allows access
    if (localStorage.getItem('eypi_token')) {
      toast.success('Welcome back.')
      if (appTransition?.value?.trigger) {
        await appTransition.value.trigger()
      }
      router.push('/dashboard')
    } else {
      throw new Error('Failed to store authentication token')
    }
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : 'Authentication failed')
    password.value = ''
  } finally {
    isAuthenticating.value = false
  }
}

const PW_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

const handleRegister = async () => {
  if (!email.value.trim() || !email.value.includes('@')) {
    errors.email = 'Enter a valid email address.'
    return
  }
  if (!PW_PATTERN.test(password.value)) {
    errors.password = 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.'
    return
  }
  if (name.value.trim().length > 200) {
    errors.name = 'Shorten your name to 200 characters or fewer.'
    return
  }
  isAuthenticating.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value, name: name.value.trim() || undefined }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed')
    }

    mode.value = 'login'
    password.value = ''
    await dialog.info({
      title: 'Check your inbox',
      body: 'We sent a verification link to your APC email. Verify before you log in.\n\nDelivery can take up to 10 minutes. Resend\'s free plan queues slowly, and APC\'s mail filters often hold new messages. Check Spam or Junk if it is not in your inbox. Still missing after 10 minutes? Message arlaus on Microsoft Teams.',
    })
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : 'Registration failed')
    password.value = ''
  } finally {
    isAuthenticating.value = false
  }
}

function onSubmit(): void {
  if (mode.value === 'login') {
    handleLogin()
  } else {
    handleRegister()
  }
}
</script>
