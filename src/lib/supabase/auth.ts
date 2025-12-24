import { createClient } from './client'

export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { user: null, error: error.message }
  }

  return { user: data.user, error: null }
}

export async function signUp(email: string, password: string, fullName?: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    return { user: null, error: error.message }
  }

  return { user: data.user, error: null }
}

export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

export async function getSession() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    return { session: null, error: error.message }
  }

  return { session: data.session, error: null }
}

export async function getUser() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    return { user: null, error: error.message }
  }

  return { user: data.user, error: null }
}
