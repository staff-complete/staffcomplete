import { createAuthClient } from 'better-auth/vue'
import { organizationClient } from 'better-auth/client/plugins'
import { DEFAULT_LOCALE } from '@staffcomplete/shared'

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      schema: {
        organization: {
          additionalFields: {
            locale: {
              type: 'string',
              required: false,
              defaultValue: DEFAULT_LOCALE,
              input: true,
            },
          },
        },
      },
    }),
  ],
})
