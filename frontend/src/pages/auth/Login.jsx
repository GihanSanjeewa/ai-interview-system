import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Input, Label, FieldError, PasswordInput } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import SocialButtons from "@/components/auth/SocialButtons";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email.";
    if (form.password.length < 6) next.password = "At least 6 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!", "Loading your workspace…");
      const dest = location.state?.from?.pathname || "/app/dashboard";
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error("Login failed", err?.message || "Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-default text-3xl font-bold">
        Welcome back
      </h1>
      <p className="text-muted mt-2 text-sm">
        Pick up where you left off. Aria is warm and ready.
      </p>

      <div className="mt-8">
        <SocialButtons />
        <div className="my-6 flex items-center gap-3">
          <span className="border-token h-px flex-1 border-t" />
          <span className="text-subtle text-xs font-semibold uppercase tracking-widest">
            or continue with email
          </span>
          <span className="border-token h-px flex-1 border-t" />
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            leftIcon={Mail}
            value={form.email}
            onChange={setField("email")}
            error={errors.email}
            autoComplete="email"
          />
          <FieldError>{errors.email}</FieldError>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-brand-400 hover:text-brand-300 text-xs font-semibold"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            value={form.password}
            onChange={setField("password")}
            autoComplete="current-password"
          />
          <FieldError>{errors.password}</FieldError>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-brand-500 size-4 rounded"
            defaultChecked
          />
          <span className="text-muted">Keep me signed in</span>
        </label>

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      <p className="text-muted mt-6 text-center text-sm">
        Don't have an account?{" "}
        <Link to="/register" className="text-brand-400 font-semibold">
          Create one — free
        </Link>
      </p>
    </div>
  );
}
