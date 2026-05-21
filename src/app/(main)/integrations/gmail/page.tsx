// src/app/(main)/integrations/gmail/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function GmailIntegrationPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-headline">
            <Mail className="mr-2 h-6 w-6 text-red-500" /> Gmail Integration
          </CardTitle>
          <CardDescription>
            Connect Editroy to your Gmail account to automatically import attachments.
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
                <strong>Google Cloud Platform (GCP) Project</strong>: A GCP project needs to be set up to manage APIs and credentials.
              </li>
              <li>
                <strong>Gmail API Enablement</strong>: The Gmail API must be enabled within the GCP project.
              </li>
              <li>
                <strong>OAuth 2.0 Credentials</strong>: An OAuth 2.0 Client ID must be created in GCP to allow users to securely grant your application permission to read their emails and attachments without sharing their passwords.
              </li>
              <li>
                <strong>Backend Authentication Flow</strong>: The application backend needs to handle the full OAuth 2.0 flow (redirecting users to Google, handling callbacks, and securely storing access/refresh tokens).
              </li>
              <li>
                <strong>Webhook for Push Notifications</strong>: To receive emails in real-time, the backend would subscribe to Gmail push notifications via Google Cloud Pub/Sub. This requires setting up a Pub/Sub topic and a subscription that points to a secure webhook endpoint on your server.
              </li>
               <li>
                <strong>Email and Attachment Processing</strong>: The backend must include logic to parse incoming emails, identify and download attachments, and add the files to the user's document queue in Editroy's database.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
