// eslint-disable-next-line simple-import-sort/imports
import { Html as EmailHtml, Head, Tailwind } from '@react-email/components';
import type { ReactNode } from 'react';

type EmailLayoutProps = {
  children: ReactNode;
  lang?: string;
  dir?: 'ltr' | 'rtl';
};

export function EmailLayout({
  children,
  dir = 'ltr',
  lang = 'en',
}: EmailLayoutProps) {
  return (
    <EmailHtml lang={lang} dir={dir}>
      <Head />
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                'brand-dark': '#09090B',
                'brand-light': '#F4F4F5',
                'brand-primary': '#044CB6',
                'brand-primary-hover': '#003F9F',
                'brand-secondary': '#F4F4F5',
                'brand-secondary-hover': '#E4E4E7',
              },
              fontFamily: {
                system: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
              },
            },
          },
        }}
      >
        {children}
      </Tailwind>
    </EmailHtml>
  );
}
