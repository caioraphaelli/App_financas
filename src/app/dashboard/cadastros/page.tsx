import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriesManager } from "@/components/dashboard/categories-manager";
import { PaymentMethodsManager } from "@/components/dashboard/payment-methods-manager";
import { PrazoSettingsForm } from "@/components/dashboard/prazo-settings-form";
import {
  getCategories,
  getPaymentMethods,
  getSubcategoriesByCategory,
  getUserSettings,
} from "@/lib/data/transactions";

export const metadata: Metadata = { title: "Cadastros — Finanças+" };

export default async function CadastrosPage() {
  const [categories, subcategoriesByCategory, paymentMethods, userSettings] = await Promise.all([
    getCategories(),
    getSubcategoriesByCategory(),
    getPaymentMethods(),
    getUserSettings(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastros</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie categorias, subcategorias, cartões de crédito, formas de pagamento e preferências.
        </p>
      </div>

      <Tabs defaultValue="categorias">
        <TabsList>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="pagamento">Formas de pagamento</TabsTrigger>
          <TabsTrigger value="prazos">Curto/Longo prazo</TabsTrigger>
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
        <TabsContent value="prazos" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <PrazoSettingsForm settings={userSettings} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
