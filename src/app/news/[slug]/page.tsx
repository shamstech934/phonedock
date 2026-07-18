import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Calendar, User, Newspaper, ArrowLeft } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitize';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { connectDB } from '@/lib/mongodb';
import { News } from '@/lib/models';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';

/* ── Types ─────────────────────────────────────────────────────────── */
interface NewsArticle {
  _id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: string;
  image: string;
  author: string;
  published: boolean;
  status: string;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
}

/* ── Data fetchers ─────────────────────────────────────────────────── */
async function getNewsArticle(slug: string): Promise<NewsArticle | null> {
  try {
    await connectDB();
    const article = await News.findOne({
      slug,
      published: true,
      status: 'published',
    })
      .select('title slug content excerpt category image author published status seoTitle seoDescription createdAt')
      .lean();

    if (!article) return null;

    return {
      _id: String(article._id),
      title: article.title,
      slug: article.slug,
      content: article.content,
      excerpt: article.excerpt,
      category: article.category,
      image: article.image,
      author: article.author,
      published: article.published,
      status: article.status,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      createdAt: article.createdAt ? new Date(article.createdAt).toISOString() : '',
    };
  } catch {
    return null;
  }
}

async function getRelatedNews(currentSlug: string, category: string, limit = 4): Promise<NewsArticle[]> {
  try {
    await connectDB();
    const articles = await News.find({
      slug: { $ne: currentSlug },
      published: true,
      status: 'published',
      ...(category && category !== 'General' ? { category } : {}),
    })
      .sort({ createdAt: -1 })
      .select('title slug excerpt category image author createdAt')
      .limit(limit)
      .lean();

    return articles.map((a: any) => ({
      _id: String(a._id),
      title: a.title,
      slug: a.slug,
      content: '',
      excerpt: a.excerpt || '',
      category: a.category || 'General',
      image: a.image || '',
      author: a.author || '',
      published: true,
      status: a.status || 'published',
      seoTitle: '',
      seoDescription: '',
      createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : '',
    }));
  } catch {
    return [];
  }
}

/* ── generateStaticParams ──────────────────────────────────────────── */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    await connectDB();
    const articles = await News.find({ published: true, status: 'published' })
      .select('slug')
      .lean();
    return articles.map((a: any) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

/* ── generateMetadata ──────────────────────────────────────────────── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsArticle(slug);

  if (!article) {
    return { title: 'News Not Found | PhoneDock Pakistan' };
  }

  const title = article.seoTitle || `${article.title} | PhoneDock Pakistan`;
  const description =
    article.seoDescription ||
    article.excerpt ||
    `Read the latest news about ${article.title} on PhoneDock Pakistan.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/news/${article.slug}` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/news/${article.slug}`,
      type: 'article',
      publishedTime: article.createdAt,
      authors: article.author ? [article.author] : undefined,
      images: article.image ? [{ url: article.image, width: 1200, height: 630, alt: article.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: article.image ? [article.image] : undefined,
    },
  };
}

/* ── Page Component ────────────────────────────────────────────────── */
export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [article, related] = await Promise.all([
    getNewsArticle(slug),
    getRelatedNews(slug, ''),
  ]);

  if (!article) {
    notFound();
  }

  const formattedDate = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  /* JSON-LD structured data */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt || article.content?.substring(0, 200),
    image: article.image || undefined,
    datePublished: article.createdAt,
    dateModified: article.createdAt,
    author: article.author
      ? {
          '@type': 'Person',
          name: article.author,
        }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'PhoneDock',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/news/${article.slug}`,
    },
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 animate-fade-in">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
            <Link href="/" className="hover:text-blue-500 transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/news" className="hover:text-blue-500 transition-colors">News</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700 font-medium truncate max-w-[200px] sm:max-w-[300px]">{article.title}</span>
          </nav>

          {/* Back link */}
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to News
          </Link>

          {/* Article Header */}
          <article>
            <div className="mb-6">
              <span className="inline-block px-3 py-1 rounded-lg text-[10px] font-medium bg-blue-50 text-blue-600 mb-3">
                {article.category || 'General'}
              </span>
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
                {article.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {article.author && (
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {article.author}
                  </span>
                )}
                {formattedDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formattedDate}
                  </span>
                )}
              </div>
            </div>

            {/* Featured Image */}
            {article.image && (
              <div className="bg-[#F8FAFC] rounded-2xl overflow-hidden mb-8 flex items-center justify-center p-4 sm:p-6">
                <Image
                  src={article.image}
                  alt={article.title}
                  width={800}
                  height={450}
                  className="object-contain rounded-xl max-h-[400px] w-auto"
                  unoptimized
                  priority
                />
              </div>
            )}

            {/* Article Content */}
            <div className="prose prose-gray max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-blue-500 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl">
              {article.excerpt && (
                <p className="text-lg text-gray-700 leading-relaxed font-medium mb-6 border-l-4 border-blue-500 pl-4">
                  {article.excerpt}
                </p>
              )}
              <div
                className="text-gray-700 leading-relaxed whitespace-pre-line text-[15px]"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(
                    article.content
                      ? article.content.replace(/\n/g, '<br />')
                      : ''
                  ),
                }}
              />
            </div>
          </article>

          {/* Related News */}
          {related.length > 0 && (
            <section className="mt-12 pt-8 border-t border-gray-200/60">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-gray-900 mb-6">
                Related News
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {related.map((item) => (
                  <Link
                    key={item._id}
                    href={`/news/${item.slug}`}
                    className="card-premium p-5 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 transition-all duration-300 group"
                  >
                    {item.image && (
                      <div className="bg-[#F8FAFC] rounded-xl mb-3 flex items-center justify-center p-3 aspect-video overflow-hidden">
                        <Image
                          src={item.image}
                          alt={item.title}
                          width={300}
                          height={180}
                          className="object-contain rounded-lg max-h-36 w-auto group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      </div>
                    )}
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-600 mb-2">
                      {item.category || 'General'}
                    </span>
                    <h3 className="font-bold text-sm text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{item.excerpt}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Empty state for no related news */}
          {related.length === 0 && (
            <section className="mt-12 pt-8 border-t border-gray-200/60">
              <div className="text-center py-8">
                <Link
                  href="/news"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 shadow-sm shadow-blue-500/25 transition-colors"
                >
                  <Newspaper className="w-4 h-4" />
                  Browse All News
                </Link>
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}