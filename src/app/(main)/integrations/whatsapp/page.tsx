// src/app/(main)/integrations/whatsapp/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function WhatsAppIntegrationPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-headline">
            <MessageSquare className="mr-2 h-6 w-6 text-green-500" /> WhatsApp Integration
          </CardTitle>
          <CardDescription>
            Connect Editroy to WhatsApp to receive documents directly from your chats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg mb-2">Backend Setup Required</h3>
            <p className="text-muted-foreground mb-4">
              To enable this integration, the following backend services and configurations are necessary. This is a technical overview for a developer.
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>
                <strong>Meta for Developers App</strong>: A Meta app must be created with the WhatsApp Business API configured. This provides the necessary API credentials.
              </li>
              <li>
                <strong>WhatsApp Business Account</strong>: A verified WhatsApp Business Account (WABA) is required to use the API.
              </li>
              <li>
                <strong>Dedicated Phone Number</strong>: A phone number must be provisioned specifically for the WhatsApp bot. This number cannot be used with a personal WhatsApp account.
              </li>
              <li>
                <strong>Webhook Endpoint</strong>: A secure backend endpoint (webhook) needs to be built and registered with the Meta app. This endpoint will receive incoming message notifications, including files sent by users.
              </li>
              <li>
                <strong>OAuth 2.0 for User Authorization</strong>: To connect a user's WhatsApp, the backend would implement an OAuth 2.0 flow to securely grant permissions without exposing user credentials.
              </li>
               <li>
                <strong>File Handling Logic</strong>: The backend must process incoming files from the webhook, temporarily store them, and then add them to the user's document queue in Editroy's database.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
