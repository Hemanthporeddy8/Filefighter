// src/app/(main)/document-utilities/[[...slug]]/page.tsx
import type { Metadata } from 'next';
import { buildToolMetadata } from '@/lib/seo';
import { DocumentUtilitiesClient } from './DocumentUtilitiesClient';

interface Props {
  params: {
    slug?: string[];
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = params.slug?.[0];
  if (!slug) {
    return {
      title: 'Document Utilities — Editroy',
      description: 'Ultimate offline browser-based document operations and PDF conversion tools.',
    };
  }
  try {
    return buildToolMetadata(slug);
  } catch (e) {
    return {
      title: 'Document Utilities — Editroy',
      description: 'Ultimate offline browser-based document operations and PDF conversion tools.',
    };
  }
}

export default function Page({ params }: Props) {
  return <DocumentUtilitiesClient slug={params.slug?.[0]} />;
}
