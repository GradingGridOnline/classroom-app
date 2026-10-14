/**
 * SupabaseProvider — stores each "file" as one row in the `files` table of
 * your Supabase project, scoped to the signed-in user (Row Level Security
 * in sql/supabase-setup.sql guarantees nobody can read anyone else's rows).
 *
 * Implements the StorageProvider contract — see storage-provider.js — so
 * the rest of the app doesn't care where data lives.
 *
 * Google features (email collection via Google Forms, emailing reports via
 * Gmail) still need a Google token; getAccessToken() hands those a Google
 * sign-in on demand, separate from the Supabase login.
 */
class SupabaseProvider extends StorageProvider {
  constructor(config) {
    super();
    this.config = config;
    this.client = null;
    this.session = null;
    this.google = null;
  }

  async init() {
    await this._waitForSupabaseScript();
    const { url, anonKey } = this.config.supabase;
    if (!url || !anonKey || anonKey.startsWith("PASTE")) {
      throw new Error("Supabase isn't configured yet (js/config.js is missing the anon key).");
    }
    this.client = window.supabase.createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await this.client.auth.getSession();
    this.session = data.session || null;
    this.client.auth.onAuthStateChange((event, session) => {
      this.session = session || null;
      if (event === "PASSWORD_RECOVERY" && typeof window.onPasswordRecovery === "function") {
        window.onPasswordRecovery();
      }
    });
  }

  async _waitForSupabaseScript(timeoutMs = 8000) {
    const start = Date.now();
    while (!window.supabase || !window.supabase.createClient) {
      if (Date.now() - start > timeoutMs) {
        throw new Error("The sign-in library failed to load. Check your internet connection and reload.");
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /** Email + password sign-in. */
  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this._friendly(error));
    this.session = data.session;
  }

  /** Creates an account. Returns { needsConfirmation: true } if Supabase wants the email address confirmed first. */
  async signUp(email, password) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw new Error(this._friendly(error));
    this.session = data.session || null;
    return { needsConfirmation: !data.session };
  }

  async resetPassword(email) {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(this._friendly(error));
  }

  async updatePassword(newPassword) {
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) throw new Error(this._friendly(error));
  }

  async signOut() {
    try {
      await this.client.auth.signOut();
    } catch (e) {}
    this.session = null;
  }

  isSignedIn() {
    return !!(this.session && this.session.user);
  }

  getUserName() {
    return this.session && this.session.user ? this.session.user.email : null;
  }

  _uid() {
    if (!this.isSignedIn()) throw new Error("You're not signed in.");
    return this.session.user.id;
  }

  async saveFile(fileName, dataObject) {
    const uid = this._uid();
    const { error } = await this.client
      .from("files")
      .upsert({ user_id: uid, name: fileName, data: dataObject, updated_at: new Date().toISOString() }, { onConflict: "user_id,name" });
    if (error) throw new Error(`Failed to save ${fileName}: ${error.message}`);
    return true;
  }

  async loadFile(fileName) {
    const uid = this._uid();
    const { data, error } = await this.client.from("files").select("data").eq("user_id", uid).eq("name", fileName).maybeSingle();
    if (error) throw new Error(`Failed to load ${fileName}: ${error.message}`);
    return data ? data.data : null;
  }

  async listFiles() {
    const uid = this._uid();
    const { data, error } = await this.client.from("files").select("name").eq("user_id", uid);
    if (error) throw new Error(`Failed to list files: ${error.message}`);
    return data.map((r) => r.name);
  }

  async deleteFile(fileName) {
    const uid = this._uid();
    const { error } = await this.client.from("files").delete().eq("user_id", uid).eq("name", fileName);
    if (error) throw new Error(`Failed to delete ${fileName}: ${error.message}`);
  }

  /** Google token for the Forms / Gmail features (separate from the Supabase login). */
  async getAccessToken() {
    const g = await this.getGoogle();
    return g.getAccessToken();
  }

  async getGoogle() {
    if (!this.google) {
      this.google = new GoogleDriveProvider(this.config);
      await this.google.initInteractive();
    }
    return this.google;
  }

  _friendly(error) {
    const m = (error && error.message) || "Something went wrong.";
    if (/invalid login credentials/i.test(m)) return "Email or password is wrong.";
    if (/email not confirmed/i.test(m)) return "Please confirm your email first — check your inbox for the link.";
    if (/already registered/i.test(m)) return "That email already has an account. Try signing in instead.";
    if (/password should be at least/i.test(m)) return "Password must be at least 8 characters.";
    if (/rate limit/i.test(m)) return "Too many attempts — wait a few minutes and try again.";
    return m;
  }
}
