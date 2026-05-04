// src/app/admin/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Edit, X, BookOpen, UploadCloud, FileUp, Download } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert } from 'lucide-react';
import { saveCustomWord, saveCustomDictionaryBatch, loadAllCustomDictionariesIntoEngine } from '@/lib/custom-dictionary-store';
import JSZip from 'jszip';
import { FileUpload } from '@/components/app/file-upload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Ad {
  id: string;
  name: string;
  imageUrl: string;
  destinationUrl: string;
  status: 'Active' | 'Inactive';
}

const initialAds: Ad[] = [
  {
    id: 'ad-1',
    name: 'Public Banner Ad',
    imageUrl: 'https://placehold.co/728x90.png',
    destinationUrl: 'https://example.com',
    status: 'Active',
  },
  {
    id: 'ad-2',
    name: 'Upload Page Ad Slot',
    imageUrl: 'https://placehold.co/320x100.png',
    destinationUrl: 'https://example.com/promo',
    status: 'Active',
  },
  {
    id: 'ad-3',
    name: 'Utilities Page Side Ad',
    imageUrl: 'https://placehold.co/250x250.png',
    destinationUrl: 'https://example.com/tools',
    status: 'Active',
  }
];

const supportedLanguages = [
    { value: 'amharic', label: 'Amharic' },
    { value: 'arabic', label: 'Arabic' },
    { value: 'bengali', label: 'Bengali' },
    { value: 'belarusian', label: 'Belarusian' },
    { value: 'bulgarian', label: 'Bulgarian' },
    { value: 'mandarin', label: 'Chinese (Mandarin)' },
    { value: 'cantonese', label: 'Chinese (Cantonese)' },
    { value: 'hokkien', label: 'Chinese (Hokkien)' },
    { value: 'french', label: 'French' },
    { value: 'german', label: 'German' },
    { value: 'greek', label: 'Greek' },
    { value: 'gujarati', label: 'Gujarati' },
    { value: 'hebrew', label: 'Hebrew' },
    { value: 'hindi', label: 'Hindi' },
    { value: 'italian', label: 'Italian' },
    { value: 'japanese', label: 'Japanese' },
    { value: 'kannada', label: 'Kannada' },
    { value: 'malayalam', label: 'Malayalam' },
    { value: 'marathi', label: 'Marathi' },
    { value: 'nepali', label: 'Nepali' },
    { value: 'oriya', label: 'Odia' },
    { value: 'persian', label: 'Persian' },
    { value: 'portuguese', label: 'Portuguese' },
    { value: 'punjabi', label: 'Punjabi' },
    { value: 'russian', label: 'Russian' },
    { value: 'sanskrit', label: 'Sanskrit' },
    { value: 'serbian', label: 'Serbian' },
    { value: 'sinhala', label: 'Sinhala' },
    { value: 'spanish', label: 'Spanish' },
    { value: 'tamil', label: 'Tamil' },
    { value: 'telugu', label: 'Telugu' },
    { value: 'tigrinya', label: 'Tigrinya' },
    { value: 'ukrainian', label: 'Ukrainian' },
    { value: 'urdu', label: 'Urdu' },
    { value: 'vietnamese', label: 'Vietnamese' },
];

export default function AdminPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [ads, setAds] = useState<Ad[]>(initialAds);
  
  // State for the Ad form
  const [adName, setAdName] = useState('');
  const [adUrl, setAdUrl] = useState('');
  const [adImage, setAdImage] = useState<File | null>(null);
  const [adImageUrl, setAdImageUrl] = useState<string | null>(null);
  
  // State for Ad editing
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  
  // State for Dictionary form
  const dictionaryFormRef = useRef<HTMLFormElement>(null);
  const [isDictionarySubmitting, setIsDictionarySubmitting] = useState(false);
  const bulkUploadFormRef = useRef<HTMLFormElement>(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (editingAdId) {
      const adToEdit = ads.find(ad => ad.id === editingAdId);
      if (adToEdit) {
        setAdName(adToEdit.name);
        setAdUrl(adToEdit.destinationUrl);
        setAdImageUrl(adToEdit.imageUrl);
        setAdImage(null);
      }
    } else {
      setAdName('');
      setAdUrl('');
      setAdImage(null);
      setAdImageUrl(null);
    }
  }, [editingAdId, ads]);

  const handleFileSelect = (files: File[]) => {
    const file = files[0];
    if (file) {
      setAdImage(file);
      setAdImageUrl(URL.createObjectURL(file));
    }
  };

  const resetAdForm = () => {
    setAdName('');
    setAdUrl('');
    setAdImage(null);
    setAdImageUrl(null);
    setEditingAdId(null);
  };

  const handleAdSubmit = () => {
    if (!adName || !adUrl) {
      toast({ title: 'Missing Information', description: 'Please provide an ad name and destination URL.', variant: 'destructive' });
      return;
    }

    if (editingAdId) {
      const imageUrl = adImage ? adImageUrl : ads.find(ad => ad.id === editingAdId)?.imageUrl;
      if (!imageUrl) {
          toast({ title: 'Image Missing', description: 'Please re-upload an image for the ad.', variant: 'destructive' });
          return;
      }
      const updatedAd: Ad = {
        id: editingAdId,
        name: adName,
        destinationUrl: adUrl,
        imageUrl: imageUrl,
        status: 'Active',
      };
      setAds(prevAds => prevAds.map(ad => ad.id === editingAdId ? updatedAd : ad));
      toast({ title: 'Ad Updated', description: `Successfully updated "${adName}".` });
    } else {
      if (!adImage || !adImageUrl) {
        toast({ title: 'Image Missing', description: 'Please upload an image for the new ad.', variant: 'destructive' });
        return;
      }
      const newAd: Ad = {
        id: `ad-${Date.now()}`,
        name: adName,
        destinationUrl: adUrl,
        imageUrl: adImageUrl,
        status: 'Active',
      };
      setAds(prevAds => [...prevAds, newAd]);
      toast({ title: 'Ad Added', description: `Successfully added "${adName}".` });
    }
    
    resetAdForm();
  };
  
  const handleEditClick = (ad: Ad) => {
    setEditingAdId(ad.id);
  };

  const handleRemoveAd = (id: string) => {
    setAds(prevAds => prevAds.filter(ad => ad.id !== id));
    toast({ title: 'Ad Removed', description: 'The advertisement has been removed.' });
    if(editingAdId === id) {
      resetAdForm();
    }
  };

  async function handleDictionarySubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setIsDictionarySubmitting(true);
      const formData = new FormData(e.currentTarget);
      const language = formData.get('language') as string;
      const phoneticWord = formData.get('phoneticWord') as string;
      const transliteratedWord = formData.get('transliteratedWord') as string;

      const result = await saveCustomWord(language, phoneticWord, transliteratedWord);
      
      // Reload into engine immediately
      await loadAllCustomDictionariesIntoEngine();

      setIsDictionarySubmitting(false);

      if (result.success) {
          toast({
              title: 'Success',
              description: result.message,
          });
          dictionaryFormRef.current?.reset();
      } else {
          toast({
              title: 'Error',
              description: result.message,
              variant: 'destructive',
          });
      }
  }

  async function handleBulkUploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsBulkSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const language = formData.get('language') as string;
    const file = formData.get('zipFile') as File;

    if (!file || !file.name.endsWith('.zip')) {
        toast({ title: 'Error', description: 'A .zip file is required.', variant: 'destructive' });
        setIsBulkSubmitting(false);
        return;
    }

    try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        const newWords: Record<string, string> = {};

        for (const filename in zip.files) {
            if (filename.endsWith('.json')) {
                const zipEntry = zip.files[filename];
                const jsonContent = await zipEntry.async('string');
                const data = JSON.parse(jsonContent);

                if (typeof data === 'object' && data !== null) {
                    for (const [phonetic, trans] of Object.entries(data)) {
                        if (phonetic && trans) {
                            newWords[phonetic] = trans as string;
                        }
                    }
                }
            }
        }

        const result = await saveCustomDictionaryBatch(language, newWords);
        
        // Reload engine
        await loadAllCustomDictionariesIntoEngine();
        
        setIsBulkSubmitting(false);

        if (result.success) {
            toast({
                title: 'Bulk Upload Complete',
                description: result.message,
                duration: 9000,
            });
            bulkUploadFormRef.current?.reset();
        } else {
             toast({
                title: 'Bulk Upload Error',
                description: result.message,
                variant: 'destructive',
             });
        }
    } catch (error: any) {
        setIsBulkSubmitting(false);
        toast({ title: 'Error', description: `Error processing zip: ${error.message}`, variant: 'destructive' });
    }
  }

  const handleDownloadTemplate = () => {
    const csvContent = "phoneticWord,transliteratedWord\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "template.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };


  if (isLoading) {
    return (
      <div className="flex-1 grid gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="lg:col-span-1 space-y-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
        <div className="flex flex-col items-center justify-center text-center p-8">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-2xl font-bold">Access Denied</h2>
            <p className="text-muted-foreground mt-2">
                You must be logged in to access the admin panel.
            </p>
            <Button onClick={() => router.push('/login')} className="mt-4">
                Go to Login
            </Button>
        </div>
    );
  }
  
  return (
    <div className="grid flex-1 items-start gap-4 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
      <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Advertisements</CardTitle>
            <CardDescription>
              Manage the advertisements displayed on public-facing pages like the QR upload page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Destination URL</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => (
                  <TableRow key={ad.id} className={editingAdId === ad.id ? 'bg-primary/10' : ''}>
                    <TableCell>
                      <Image
                        alt={ad.name}
                        className="aspect-video rounded-md object-contain"
                        height="64"
                        src={ad.imageUrl}
                        width="128"
                        data-ai-hint="advertisement banner"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{ad.name}</TableCell>
                    <TableCell>
                      <Badge variant={ad.status === 'Active' ? 'default' : 'secondary'}>
                        {ad.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <a href={ad.destinationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate">
                        {ad.destinationUrl}
                      </a>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                       <Button size="icon" variant="outline" onClick={() => handleEditClick(ad)}>
                          <Edit className="h-4 w-4" />
                       </Button>
                       <Button size="icon" variant="destructive" onClick={() => handleRemoveAd(ad.id)}>
                          <Trash2 className="h-4 w-4" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><BookOpen className="mr-2 h-5 w-5"/>Dictionary Management</CardTitle>
                <CardDescription>
                    Improve transliteration accuracy by adding new words to the dictionaries. Changes are saved directly to the server files.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="single" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="single">Add Single Word</TabsTrigger>
                        <TabsTrigger value="bulk">Bulk Add</TabsTrigger>
                    </TabsList>
                    <TabsContent value="single" className="pt-4">
                        <form onSubmit={handleDictionarySubmit} ref={dictionaryFormRef} className="space-y-4">
                            <div className="grid gap-3">
                                <Label htmlFor="language">Language</Label>
                                <Select name="language" defaultValue="hindi">
                                    <SelectTrigger id="language" className="w-full">
                                        <SelectValue placeholder="Select Language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {supportedLanguages.map(lang => (
                                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-3">
                                    <Label htmlFor="phoneticWord">Phonetic English</Label>
                                    <Input name="phoneticWord" id="phoneticWord" placeholder="e.g., 'namaste'" required />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="transliteratedWord">Transliterated Text</Label>
                                    <Input name="transliteratedWord" id="transliteratedWord" placeholder="e.g., 'नमस्ते'" required />
                                </div>
                            </div>
                            <Button type="submit" disabled={isDictionarySubmitting}>
                                <PlusCircle className="mr-2 h-4 w-4" /> 
                                {isDictionarySubmitting ? 'Adding...' : 'Add Word to Dictionary'}
                            </Button>
                        </form>
                    </TabsContent>
                    <TabsContent value="bulk" className="pt-4">
                        <form onSubmit={handleBulkUploadSubmit} ref={bulkUploadFormRef} className="space-y-4">
                            <div className="grid gap-3">
                                <Label htmlFor="bulk-language">Language</Label>
                                <Select name="language" defaultValue="hindi">
                                    <SelectTrigger id="bulk-language" className="w-full">
                                        <SelectValue placeholder="Select Language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {supportedLanguages.map(lang => (
                                            <SelectItem key={`bulk-${lang.value}`} value={lang.value}>{lang.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="zipFile">Upload Zip File</Label>
                                <Input id="zipFile" name="zipFile" type="file" accept=".zip" required />
                                <CardDescription>
                                    The zip file should contain your dictionary as multiple JSON files.
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" disabled={isBulkSubmitting}>
                                    <FileUp className="mr-2 h-4 w-4" /> 
                                    {isBulkSubmitting ? 'Processing...' : 'Upload and Process Zip'}
                                </Button>
                            </div>
                        </form>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
      </div>
      <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>{editingAdId ? 'Edit Ad' : 'Add New Ad'}</CardTitle>
            <CardDescription>
              {editingAdId ? 'Update the details for this advertisement.' : 'Upload an image and provide the details for a new advertisement.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-3">
              <Label htmlFor="ad-name">Ad Name</Label>
              <Input id="ad-name" type="text" className="w-full" value={adName} onChange={e => setAdName(e.target.value)} placeholder="e.g., Summer Sale Banner" />
            </div>
             <div className="grid gap-3">
              <Label htmlFor="ad-url">Destination URL</Label>
              <Input id="ad-url" type="url" className="w-full" value={adUrl} onChange={e => setAdUrl(e.target.value)} placeholder="https://example.com/product" />
            </div>
            <div className="grid gap-3">
              <Label>Ad Image</Label>
               {adImageUrl && !adImage && (
                  <div className="mb-2">
                    <p className="text-xs text-muted-foreground mb-1">Current Image:</p>
                    <Image src={adImageUrl} alt="Current ad image" width={128} height={64} className="rounded-md border object-contain" data-ai-hint="advertisement"/>
                  </div>
               )}
              <FileUpload 
                label={editingAdId ? "Upload to replace" : ""} 
                onFileSelect={handleFileSelect} 
                acceptedFileTypes="image/*"
                id="ad-image-upload"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button onClick={handleAdSubmit} className="w-full">
              {editingAdId ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              {editingAdId ? 'Update Advertisement' : 'Add Advertisement'}
            </Button>
            {editingAdId && (
              <Button onClick={resetAdForm} variant="outline" className="w-full">
                <X className="mr-2 h-4 w-4" /> Cancel Edit
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
