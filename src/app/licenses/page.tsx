import { BackButton } from '@/components/ui/BackButton';
import Layout from '@/components/Layout';

export const metadata = {
  title: '오픈소스 라이선스 — 이천점',
};

const LIBRARIES = [
  { name: 'React', version: '19.x', license: 'MIT', url: 'https://github.com/facebook/react', author: 'Meta' },
  { name: 'React DOM', version: '19.x', license: 'MIT', url: 'https://github.com/facebook/react', author: 'Meta' },
  { name: 'Next.js', version: '16.x', license: 'MIT', url: 'https://github.com/vercel/next.js', author: 'Vercel' },
  { name: 'Tailwind CSS', version: '4.x', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss', author: 'Tailwind Labs' },
  { name: 'Zustand', version: '5.x', license: 'MIT', url: 'https://github.com/pmndrs/zustand', author: 'Poimandres' },
  { name: 'Framer Motion', version: '12.x', license: 'MIT', url: 'https://github.com/framer/motion', author: 'Framer' },
  { name: 'Supabase JS', version: '2.x', license: 'MIT', url: 'https://github.com/supabase/supabase-js', author: 'Supabase' },
  { name: 'Axios', version: '1.x', license: 'MIT', url: 'https://github.com/axios/axios', author: 'Matt Zabriskie' },
  { name: 'date-fns', version: '4.x', license: 'MIT', url: 'https://github.com/date-fns/date-fns', author: 'Sasha Koss' },
  { name: 'Zod', version: '4.x', license: 'MIT', url: 'https://github.com/colinhacks/zod', author: 'Colin McDonnell' },
  { name: 'Lucide React', version: '0.x', license: 'ISC', url: 'https://github.com/lucide-icons/lucide', author: 'Lucide Contributors' },
  { name: 'lunar-javascript', version: '1.x', license: 'MIT', url: 'https://github.com/6tail/lunar-javascript', author: '6tail' },
  { name: 'iztro (紫微斗数)', version: '2.x', license: 'MIT', url: 'https://github.com/SylarLong/iztro', author: 'SylarLong' },
  { name: 'PortOne Browser SDK', version: '0.x', license: 'Apache-2.0', url: 'https://github.com/portone-io/browser-sdk', author: 'PortOne' },
  { name: 'TypeScript', version: '5.x', license: 'Apache-2.0', url: 'https://github.com/microsoft/TypeScript', author: 'Microsoft' },
];

export default function LicensesPage() {
  return (
    <Layout>
    <div className="px-4 pt-4 pb-12">
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            오픈소스 라이선스
          </h1>
        </div>
      </div>

      <div className="rounded-2xl p-6 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <p className="text-[13px] text-text-tertiary mb-5">
          이천점 서비스는 아래의 오픈소스 소프트웨어를 사용하고 있습니다.
          각 소프트웨어의 저작권과 라이선스를 존중하며, 해당 라이선스 조건에 따라 사용하고 있습니다.
        </p>

        <div className="space-y-3">
          {LIBRARIES.map((lib) => (
            <div
              key={lib.name}
              className="p-3 rounded-xl bg-[rgba(20,12,38,0.4)] border border-[var(--border-subtle)]"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[14px] font-semibold text-text-primary">{lib.name}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(124,92,252,0.12)] text-cta/80 font-medium">
                  {lib.license}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
                <span>{lib.author}</span>
                <span className="opacity-40">·</span>
                <span>v{lib.version}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-[var(--border-subtle)] space-y-3 text-[12px] text-text-tertiary">
          <div>
            <p className="font-medium text-text-secondary mb-1">MIT License</p>
            <p>
              Permission is hereby granted, free of charge, to any person obtaining a copy of this
              software and associated documentation files, to deal in the Software without restriction,
              including without limitation the rights to use, copy, modify, merge, publish, distribute,
              sublicense, and/or sell copies of the Software, subject to the following conditions:
              The above copyright notice and this permission notice shall be included in all copies
              or substantial portions of the Software. THE SOFTWARE IS PROVIDED &quot;AS IS&quot;,
              WITHOUT WARRANTY OF ANY KIND.
            </p>
          </div>
          <div>
            <p className="font-medium text-text-secondary mb-1">ISC License</p>
            <p>
              Permission to use, copy, modify, and/or distribute this software for any purpose with
              or without fee is hereby granted, provided that the above copyright notice and this
              permission notice appear in all copies. THE SOFTWARE IS PROVIDED &quot;AS IS&quot;.
            </p>
          </div>
          <div>
            <p className="font-medium text-text-secondary mb-1">Apache License 2.0</p>
            <p>
              Licensed under the Apache License, Version 2.0. You may obtain a copy of the License at
              http://www.apache.org/licenses/LICENSE-2.0. Unless required by applicable law or agreed
              to in writing, software distributed under the License is distributed on an &quot;AS IS&quot; BASIS,
              WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
          <p className="text-[12px] text-text-tertiary">
            (주)하트웨어
          </p>
        </div>
      </div>
    </div>
    </Layout>
  );
}
