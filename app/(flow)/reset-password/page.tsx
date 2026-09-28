import { ResetPassword } from "./ResetPassword";

/**
 * Where a recovery link lands, by way of /auth/callback.
 *
 * Not public: the callback exchanges the link's code for a session first, so
 * anyone arriving here without one is sent to sign in by the middleware. That
 * is what stops the screen being a way to set a password on someone else's
 * account.
 */
export default function ResetPasswordPage() {
  return <ResetPassword />;
}
