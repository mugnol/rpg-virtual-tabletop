export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div data-testid="form-error" className="form-error" role="alert">
      {message}
    </div>
  );
}
