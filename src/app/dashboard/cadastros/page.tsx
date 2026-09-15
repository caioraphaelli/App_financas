import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriesManager } from "@/components/dashboard/categories-manager";
import { PaymentMethodsManager } from "@/components/dashboard/payment-methods-manager";
import { getCategories, getPaymentMethods, getSubcategoriesByCategory } from "@/lib/data/transactions";

export const metadata: Metadata = { title: "Cadastros — Finanças+" };

export default async function CadastrosPage() {
  const [categories, subcategoriesByCategory, paymentMethods] = await Promise.all([
    getCategories(),
    getSubcategoriesByCategory(),
    getPaymentMethods(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastros</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie categorias, subcategorias, cartões de crédito e formas de pagamento.
        </p>
      </div>

      <Tabs defaultValue="categorias">
        <TabsList>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="pagamento">Formas de pagamento</TabsTrigger>
        </TabsList>
        <TabsContent value="categorias" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <CategoriesManager categories={categories} subcategoriesByCategory={subcategoriesByCategory} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pagamento" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <PaymentMethodsManager methods={paymentMethods} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
