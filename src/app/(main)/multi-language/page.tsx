// src/app/(main)/multi-language/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Languages, Copy, Volume2, ArrowRightLeft, Loader2, X, Star } from 'lucide-react';
import { getSuggestions, transliterate } from '@/lib/transliterator';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import pinyin from 'pinyin';
import wanakana from 'wanakana';

const supportedLanguages = [
    { value: 'te', label: 'Telugu' },
    { value: 'hi', label: 'Hindi' },
    { value: 'ta', label: 'Tamil' },
    { value: 'kn', label: 'Kannada' },
    { value: 'ml', label: 'Malayalam' },
    { value: 'bn', label: 'Bengali' },
    { value: 'gu', label: 'Gujarati' },
    { value: 'mr', label: 'Marathi' },
    { value: 'pa', label: 'Punjabi' },
    { value: 'si', label: 'Sinhala' },
    { value: 'ur', label: 'Urdu' },
    { value: 'sd', label: 'Sindhi' },
    { value: 'zh-mandarin', label: 'Chinese (Mandarin)' },
    { value: 'zh-cantonese', label: 'Chinese (Cantonese)' },
    { value: 'zh-hokkien', label: 'Chinese (Hokkien)' },
    { value: 'ja', label: 'Japanese' },
];

export default function MultiLanguageTyperPage() {
    const [sourceText, setSourceText] = useState('');
    const [targetText, setTargetText] = useState('');
    const [sourceLang, setSourceLang] = useState('en-phonetic');
    const [targetLang, setTargetLang] = useState('te');
    const [mode, setMode] = useState('transliterate');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const { toast } = useToast();
    const [isDictLoading, setIsDictLoading] = useState(false);

    // Lazy load dictionaries
    useEffect(() => {
        const loadDictionaryForLang = async (lang: string) => {
            if (!(window as any).dictionaries) {
                (window as any).dictionaries = {};
            }
            if ((window as any).dictionaries[lang] && Object.keys((window as any).dictionaries[lang]).length > 0) {
                return; // Already loaded
            }

            setIsDictLoading(true);
            try {
                let dictionaryModule;
                switch (lang) {
                    case 'te': dictionaryModule = await import('@/lib/transliterator/dictionaries/telugu'); break;
                    case 'hi': dictionaryModule = await import('@/lib/transliterator/dictionaries/hindi'); break;
                    case 'ta': dictionaryModule = await import('@/lib/transliterator/dictionaries/tamil'); break;
                    case 'kn': dictionaryModule = await import('@/lib/transliterator/dictionaries/kannada'); break;
                    case 'ml': dictionaryModule = await import('@/lib/transliterator/dictionaries/malayalam'); break;
                    case 'mr': dictionaryModule = await import('@/lib/transliterator/dictionaries/marathi'); break;
                    case 'bn': dictionaryModule = await import('@/lib/transliterator/dictionaries/bengali'); break;
                    case 'gu': dictionaryModule = await import('@/lib/transliterator/dictionaries/gujarati'); break;
                    default:
                        (window as any).dictionaries[lang] = {};
                        setIsDictLoading(false);
                        return;
                }

                const varName = `${lang}Dictionary`;
                const dictionary = dictionaryModule[varName];

                if (dictionary) {
                    (window as any).dictionaries[lang] = dictionary;
                }
            } catch (error) {
                console.error(`Failed to load dictionary for ${lang}:`, error);
                toast({
                    title: `Dictionary Load Failed`,
                    description: `Could not load the dictionary for ${lang}. Transliteration might be less accurate.`,
                    variant: 'destructive',
                });
            } finally {
                setIsDictLoading(false);
            }
        };

        if (mode === 'transliterate' && targetLang) {
            loadDictionaryForLang(targetLang);
        }
    }, [targetLang, mode, toast]);


    useEffect(() => {
        if (mode !== 'transliterate' || isDictLoading) {
            setSuggestions([]);
            if (isDictLoading) {
                setTargetText('Loading dictionary...');
            } else {
                setTargetText('');
            }
            return;
        }

        if (!sourceText.trim()) {
            setTargetText('');
            setSuggestions([]);
            return;
        }

        const words = sourceText.split(/(\s+)/);
        const lastWord = words[words.length - 1];

        if (/\s+/.test(lastWord) || lastWord === '') {
            setSuggestions([]);
        } else {
            const suggs = getSuggestions(lastWord, targetLang);
            setSuggestions(suggs);
        }

        const transliteratedWords = words.map(word => {
            if (/\s+/.test(word) || word === '') return word;
            const wordSuggestions = getSuggestions(word, targetLang);
            return wordSuggestions.length > 0 ? wordSuggestions[0] : transliterate(word, targetLang);
        });
        
        setTargetText(transliteratedWords.join(''));

    }, [sourceText, targetLang, mode, isDictLoading]);

    const handleSuggestionClick = (suggestion: string) => {
        const words = sourceText.trim().split(/(\s+)/);
        const lastWordIndex = words.length - 1;
        let textBeforeLastWord = '';
        for(let i = 0; i < lastWordIndex; i++) {
             textBeforeLastWord += words[i];
        }

        const targetWords = targetText.trim().split(/(\s+)/);
        const lastTargetWordIndex = targetWords.length - 1;
        let textBeforeLastWordInTarget = '';
        for(let i = 0; i < lastTargetWordIndex; i++) {
            textBeforeLastWordInTarget += targetWords[i];
        }
        
        setSourceText(textBeforeLastWord + suggestion + ' ');
        setTargetText(textBeforeLastWordInTarget + suggestion + ' ');
        setSuggestions([]);
    };
    
    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: 'Copied to clipboard!' });
        }).catch(err => {
            toast({ title: 'Failed to copy', description: err.message, variant: 'destructive' });
        });
    };
    
     const handleSwap = () => {
        if (mode === 'translate') {
            setSourceText(targetText);
            setSourceLang(targetLang);
            setTargetLang(sourceLang === 'en-phonetic' ? 'te' : sourceLang);
        } else {
            toast({title: "Swap not available", description: "You can only swap languages in translation mode."})
        }
    };

    return (
        <Card className="shadow-lg w-full">
            <CardHeader>
                <CardTitle className="flex items-center text-2xl font-headline">
                    <Languages className="mr-2 h-6 w-6 text-primary" /> Multi-Language Typer
                </CardTitle>
                <CardDescription>
                    Translate between languages or type phonetically in your native script.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Tabs value={mode} onValueChange={setMode} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-sm">
                        <TabsTrigger value="transliterate">Transliteration</TabsTrigger>
                        <TabsTrigger value="translate">Translation (Coming Soon)</TabsTrigger>
                    </TabsList>
                </Tabs>
                
                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                    <Select value={sourceLang} onValueChange={setSourceLang} disabled={mode !== 'translate'}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="en-phonetic">English (Phonetic)</SelectItem>
                            {/* Add other source languages for translation */}
                        </SelectContent>
                    </Select>

                    <Button variant="ghost" size="icon" onClick={handleSwap} disabled={mode !== 'translate'}>
                        <ArrowRightLeft className="h-5 w-5 text-muted-foreground"/>
                    </Button>

                    <div className="relative">
                      <Select value={targetLang} onValueChange={setTargetLang}>
                          <SelectTrigger><SelectValue/></SelectTrigger>
                          <SelectContent>
                              {supportedLanguages.map(lang => (
                                  <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      {isDictLoading && <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground"/>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <Textarea
                            placeholder="Type here..."
                            value={sourceText}
                            onChange={(e) => setSourceText(e.target.value)}
                            className="min-h-[200px] text-base"
                            disabled={isDictLoading}
                        />
                         <div className="flex justify-end">
                            <Button variant="ghost" size="icon" onClick={() => handleCopyToClipboard(sourceText)}>
                                <Copy className="h-5 w-5"/>
                            </Button>
                        </div>
                    </div>
                     <div className="flex flex-col gap-2">
                        <Textarea
                            placeholder={isDictLoading ? "Loading..." : "Result appears here..."}
                            value={targetText}
                            readOnly
                            className="min-h-[200px] text-base bg-muted/50"
                        />
                         <div className="flex justify-between items-start min-h-[40px]">
                            {suggestions.length > 1 && (
                                <div className="flex flex-wrap gap-2 items-center">
                                    {suggestions.slice(1, 6).map((sugg, index) => (
                                        <Button key={index} variant="outline" size="sm" onClick={() => handleSuggestionClick(sugg)} className="text-lg">
                                            {sugg}
                                        </Button>
                                    ))}
                                </div>
                            )}
                             <div className="flex ml-auto">
                                <Button variant="ghost" size="icon" onClick={() => handleCopyToClipboard(targetText)}>
                                    <Copy className="h-5 w-5"/>
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => toast({title: "Coming Soon", description: "Text-to-speech will be implemented in a future update."})}>
                                    <Volume2 className="h-5 w-5"/>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
