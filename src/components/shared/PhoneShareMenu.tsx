'use client';

import { useState } from 'react';
import { Check, Copy, Facebook, Linkedin, Mail, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type Props = { title: string; text?: string; url?: string; compact?: boolean };

export function PhoneShareMenu({ title, text, url, compact = false }: Props) {
  const [copied, setCopied] = useState(false);
  const getUrl = () => url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = text || `${title} full specifications, price and review on PhoneDock`;
  const encoded = () => ({ u: encodeURIComponent(getUrl()), t: encodeURIComponent(shareText) });
  const open = (target: string) => window.open(target, '_blank', 'noopener,noreferrer,width=720,height=640');
  const copy = async () => {
    await navigator.clipboard.writeText(getUrl());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const nativeShare = async () => {
    if (navigator.share) await navigator.share({ title, text: shareText, url: getUrl() });
    else await copy();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={compact ? 'outline' : 'default'} className={compact ? 'h-11 rounded-xl px-4' : 'h-11 flex-1 rounded-xl bg-blue-600 hover:bg-blue-700'} aria-label="Share phone specifications">
          <Share2 className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />{compact ? null : 'Share'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Share specifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={nativeShare}><Share2 className="mr-2 h-4 w-4" /> Device share</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { const x=encoded(); open(`https://wa.me/?text=${x.t}%20${x.u}`); }}><span className="mr-2 font-bold text-emerald-600">W</span> WhatsApp</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { const x=encoded(); open(`https://www.facebook.com/sharer/sharer.php?u=${x.u}`); }}><Facebook className="mr-2 h-4 w-4" /> Facebook</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { const x=encoded(); open(`https://twitter.com/intent/tweet?text=${x.t}&url=${x.u}`); }}><span className="mr-2 font-bold">X</span> X / Twitter</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { const x=encoded(); open(`https://t.me/share/url?url=${x.u}&text=${x.t}`); }}><span className="mr-2 font-bold text-sky-500">T</span> Telegram</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { const x=encoded(); open(`https://www.linkedin.com/sharing/share-offsite/?url=${x.u}`); }}><Linkedin className="mr-2 h-4 w-4 text-blue-700" /> LinkedIn</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { const x=encoded(); window.location.href=`mailto:?subject=${encodeURIComponent(title)}&body=${x.t}%0A%0A${x.u}`; }}><Mail className="mr-2 h-4 w-4" /> Email</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copy}>{copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? 'Link copied' : 'Copy link'}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
