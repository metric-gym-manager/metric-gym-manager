import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

export interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  featured?: boolean;
  ctaText: string;
  ctaLink: string;
}

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  featured = false,
  ctaText,
  ctaLink,
}: PricingCardProps) {
  return (
    <Card
      className={`relative hover:shadow-xl transition-all duration-300 ${
        featured
          ? 'border-2 border-brand-accent shadow-xl scale-105'
          : 'border-gray-200'
      }`}
    >
      {/* "Most Popular" badge for featured card */}
      {featured && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge className="bg-brand-accent hover:bg-brand-accent/90 text-white px-4 py-1">
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-bold text-brand-charcoal">
          {name}
        </CardTitle>
        <CardDescription className="text-gray-600">
          {description}
        </CardDescription>

        {/* Price */}
        <div className="mt-4">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-brand-charcoal">
              {price}
            </span>
            {period && (
              <span className="text-gray-600">
                {period}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Features list */}
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-brand-accent flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <div className="pt-4">
          <Link href={ctaLink} className="block">
            <Button
              className={`w-full ${
                featured
                  ? 'bg-brand-accent hover:bg-brand-accent/90 text-white'
                  : 'bg-gray-900 hover:bg-gray-800 text-white'
              }`}
              size="lg"
            >
              {ctaText}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
