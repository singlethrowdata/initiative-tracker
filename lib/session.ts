import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'

export function getSession() {
  return getServerSession(authOptions)
}
