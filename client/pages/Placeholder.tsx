import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Placeholder({ title }: { title: string }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto py-10">
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle className="text-2xl font-extrabold">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              هذه الصفحة قيد الإنشاء. تابع في الدردشة لملء محتواها لاحقًا.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
