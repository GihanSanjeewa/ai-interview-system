import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, User, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Input, Label, FieldError, PasswordInput } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import SocialButtons from "@/components/auth/SocialButtons";
import { cn } from "@/lib/utils";

function strengthOf(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const strength = useMemo(() => strengthOf(form.password), [form.password]);

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Please enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (strength < 2) next.password = "Use 8+ characters with mixed letters and numbers.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success("Account created successfully", "Welcome to Inverview AI Studio!");
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      toast.error("Sign up failed", err?.message || "Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-default text-2xl sm:text-3xl font-extrabold">
          Create Candidate Profile
        </h1>
        <p className="text-muted mt-1.5 text-xs sm:text-sm">
          Get started with multi-modal AI mock interviews and CV analysis.
        </p>
      </div>

      <SocialButtons />

      <div className="my-5 flex items-center gap-3">
        <span className="border-token h-px flex-1 border-t" />
        <span className="text-subtle text-[10px] font-bold uppercase tracking-widest">
          or sign up with email
        </span>
        <span className="border-token h-px flex-1 border-t" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            placeholder="Jane Candidate"
            leftIcon={User}
            value={form.name}
            onChange={setField("name")}
            error={errors.name}
            autoComplete="name"
          />
          <FieldError>{errors.name}</FieldError>
        </div>

        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="jane@example.com"
            leftIcon={Mail}
            value={form.email}
            onChange={setField("email")}
            error={errors.email}
            autoComplete="email"
          />
          <FieldError>{errors.email}</FieldError>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={setField("password")}
            autoComplete="new-password"
            error={errors.password}
          />
          <div className="mt-2 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  i < strength
                    ? ["bg-rose-400", "bg-amber-400", "bg-amber-300", "bg-emerald-400"][strength - 1]
                    : "bg-surface-3"
                )}
              />
            ))}
          </div>
          <FieldError>{errors.password}</FieldError>
        </div>

        <Button type="submit" size="lg" className="w-full mt-2" loading={loading}>
          Create Account & Start
        </Button>
      </form>

      <p className="text-muted mt-6 text-center text-xs sm:text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-400 font-bold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
