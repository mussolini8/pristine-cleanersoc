import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import importedAccounts from "@/data/residential-accounts.json";

export function ResidentialImportsPanel() {
  return (
    <Card className="overflow-hidden rounded-2xl border border-border/65 bg-card shadow-[0_18px_58px_-50px_hsl(215_40%_20%)] mt-8">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60 bg-card px-5 py-4">
        <div>
          <CardTitle className="text-xl font-semibold tracking-normal">Imported Residential Accounts</CardTitle>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{importedAccounts.length} accounts imported</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/25 text-left text-xs font-semibold text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Provider</th>
              </tr>
            </thead>
            <tbody>
              {importedAccounts.map((acc: any, i: number) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/10">
                  <td className="px-4 py-3">{acc.Date}</td>
                  <td className="px-4 py-3">{acc.Time}</td>
                  <td className="px-4 py-3">{acc["Full name"]}</td>
                  <td className="px-4 py-3">{acc.City}</td>
                  <td className="px-4 py-3">{acc.Service}</td>
                  <td className="px-4 py-3">{acc.Frequency}</td>
                  <td className="px-4 py-3">{acc["Provider/team"]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
