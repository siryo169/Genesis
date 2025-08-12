"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Info, Key, Eye, EyeOff, Copy, Pencil, Check, Database, Cloud, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { dataProvider } from "@/lib/data-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/icons/Logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SettingsPage() {
    const { toast } = useToast();
    const [modelInfoDialog, setModelInfoDialog] = useState<{ open: boolean, model: string | null }>({ open: false, model: null });
    const [keyDialog, setKeyDialog] = useState<{ open: boolean, model: string | null }>({ open: false, model: null });
    const [isMockMode, setIsMockMode] = useState(true);
    const [showFullKey, setShowFullKey] = useState<{ [model: string]: boolean }>({});
    const [modelKeys, setModelKeys] = useState<{ [model: string]: string }>({
        'Gemini 2.5 Pro': 'AIzaSyA1234567890XyZ',
        'Gemini 2.5 Flash': 'AIzaSyB1234567890AbC',
        'Gemini 2.0 Flash': 'AIzaSyC1234567890Def',
        'o3': 'o3sk-1234567890xyz',
        'GPT-4.1 mini': 'sk-1234567890abcd',
        'Claude 3.7 Sonnet': 'claude-1234567890efg',
    });
    const [editKey, setEditKey] = useState<string>('');
    const [activeModel, setActiveModel] = useState<string>('Gemini 2.5 Flash');

    const aiModels = [
        {
          name: 'Gemini 2.5 Pro',
          pricing: '$7 per 1M input tokens, $21 per 1M output tokens',
          release: '2024-06',
          url: 'https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini',
          details: 'Best for high-accuracy, complex tasks. Supports long context.'
        },
        {
          name: 'Gemini 2.5 Flash',
          pricing: '$0.35 per 1M input tokens, $1.05 per 1M output tokens',
          release: '2024-06',
          url: 'https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini',
          details: 'Optimized for speed and cost, good for chat and summarization.'
        },
        {
          name: 'Gemini 2.0 Flash',
          pricing: '$0.35 per 1M input tokens, $1.05 per 1M output tokens',
          release: '2024-03',
          url: 'https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini',
          details: 'Previous fast Gemini model.'
        },
        {
          name: 'o3',
          pricing: 'TBD',
          release: '2024-06',
          url: 'https://openrouter.ai/models/open-orca-3',
          details: 'Open source, high-context, multi-modal.'
        },
        {
          name: 'GPT-4.1 mini',
          pricing: '$5 per 1M input tokens, $15 per 1M output tokens',
          release: '2024-05',
          url: 'https://platform.openai.com/docs/models/gpt-4',
          details: 'OpenAI, smaller context, fast.'
        },
        {
          name: 'Claude 3.7 Sonnet',
          pricing: '$3 per 1M input tokens, $15 per 1M output tokens',
          release: '2024-06',
          url: 'https://www.anthropic.com/news/claude-3-7',
          details: 'Anthropic, strong at reasoning, long context.'
        },
    ];

    useEffect(() => {
        setIsMockMode(dataProvider.getCurrentMode() === 'mock');
    }, []);
    
    useEffect(() => {
        if (keyDialog.open) {
          setEditKey('');
        }
    }, [keyDialog.open]);

    function censorKey(key: string) {
        if (key.length <= 8) return '*'.repeat(key.length);
        return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4);
    }

    function handleCopyKey(model: string) {
        navigator.clipboard.writeText(modelKeys[model]);
        toast({ title: 'Key copied to clipboard.' });
    }

    function handleEditKey(model: string) {
        setEditKey(modelKeys[model]);
    }
    
    function handleSaveKey(model: string) {
        setModelKeys(prev => ({ ...prev, [model]: editKey }));
        setKeyDialog({ open: false, model: null });
        toast({ title: 'Key updated.' });
    }

    const handleModeToggle = (checked: boolean) => {
        const newMode = checked ? 'mock' : 'real';
        setIsMockMode(checked);
        dataProvider.switchMode(newMode);
        
        toast({
          title: "Data Source Changed",
          description: `Switched to ${checked ? 'Mock Data' : 'Live API'} mode. The page will reload.`,
          variant: "default",
        });

        setTimeout(() => window.location.reload(), 1500);
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Logo />
                      <h1 className="text-xl font-bold tracking-tight text-foreground">Genesis Settings</h1>
                    </div>
                </div>
            </header>
            <main className="flex-grow p-4 md:p-8">
                <div className="mx-auto max-w-3xl space-y-8">
                    {/* Data Source Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Settings2 className="h-5 w-5" />
                                Data Source
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Switch between mock data and live API.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="mock-mode-toggle"
                                    checked={isMockMode}
                                    onCheckedChange={handleModeToggle}
                                />
                                <Label htmlFor="mock-mode-toggle" className="text-sm font-medium">
                                    {isMockMode ? 'Mock Data Mode' : 'Live API Mode'}
                                </Label>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notifications Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Notifications</CardTitle>
                            <CardDescription className="text-xs">Configure how and when you receive notifications.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Label htmlFor="notif-email" className="text-sm">Email</Label>
                                <Switch id="notif-email" />
                            </div>
                            <div className="flex items-center gap-4">
                                <Label htmlFor="notif-telegram" className="text-sm">Telegram</Label>
                                <Switch id="notif-telegram" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Models Table Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">AI Models & API Keys</CardTitle>
                            <CardDescription className="text-xs">Manage your API keys and view model details.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr>
                                        <th className="text-left p-2 font-medium text-muted-foreground">Model</th>
                                        <th className="text-right p-2 font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aiModels.map(model => (
                                        <tr key={model.name} className={`border-t ${activeModel === model.name ? 'bg-primary/10' : ''}`}>
                                            <td className="p-2 font-medium">{model.name}</td>
                                            <td className="p-2 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant={activeModel === model.name ? 'secondary' : 'ghost'}
                                                        size="icon"
                                                        onClick={() => setActiveModel(model.name)}
                                                        aria-label={activeModel === model.name ? 'Active model' : 'Activate model'}
                                                        className="h-7 w-7"
                                                    >
                                                        <Check className={`h-4 w-4 ${activeModel === model.name ? 'text-primary' : ''}`} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setModelInfoDialog({ open: true, model: model.name })}>
                                                        <Info className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setKeyDialog({ open: true, model: model.name })}>
                                                        <Key className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>
            </main>
            <Dialog open={modelInfoDialog.open} onOpenChange={open => setModelInfoDialog({ open, model: open ? modelInfoDialog.model : null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{modelInfoDialog.model} Info</DialogTitle>
                    </DialogHeader>
                    {aiModels.filter(m => m.name === modelInfoDialog.model).map(model => (
                        <div key={model.name} className="space-y-2">
                            <div><b>Pricing:</b> {model.pricing}</div>
                            <div><b>Release Date:</b> {model.release}</div>
                            <div><b>Details:</b> {model.details}</div>
                            <div><b>More Info:</b> <a href={model.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{model.url}</a></div>
                        </div>
                    ))}
                </DialogContent>
            </Dialog>
            <Dialog open={keyDialog.open} onOpenChange={open => setKeyDialog({ open, model: open ? keyDialog.model : null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{keyDialog.model} API Key</DialogTitle>
                    </DialogHeader>
                    {aiModels.filter(m => m.name === keyDialog.model).map(model => (
                        <div key={model.name}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono bg-muted px-2 py-1 rounded">
                                    {showFullKey[model.name] ? modelKeys[model.name] : censorKey(modelKeys[model.name] || '')}
                                </span>
                                <Button variant="ghost" size="icon" onClick={() => setShowFullKey(prev => ({ ...prev, [model.name]: !prev[model.name] }))}>
                                    {showFullKey[model.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleCopyKey(model.name)}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleEditKey(model.name)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex gap-2 items-center">
                                <Input value={editKey} onChange={e => setEditKey(e.target.value)} className="w-full" />
                                <Button onClick={() => handleSaveKey(model.name)} variant="secondary">Save</Button>
                            </div>
                        </div>
                    ))}
                </DialogContent>
            </Dialog>
        </div>
    );
}
