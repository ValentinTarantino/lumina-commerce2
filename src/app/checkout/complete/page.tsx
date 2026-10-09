import PaymentReturn from "./PaymentReturn";

export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ attemptId?: string }>;
}) {
  const { attemptId } = await searchParams;
  return <PaymentReturn attemptId={attemptId ?? ""} />;
}
