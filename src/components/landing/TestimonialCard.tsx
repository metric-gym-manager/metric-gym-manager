import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';

export interface TestimonialCardProps {
  quote: string;
  name: string;
  role: string;
  gymName: string;
  rating: number;
}

export function TestimonialCard({ quote, name, role, gymName, rating }: TestimonialCardProps) {
  return (
    <Card className="min-w-[320px] md:min-w-[400px] bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardContent className="pt-6 space-y-4">
        {/* Star rating */}
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className={`h-5 w-5 ${
                index < rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-gray-200 text-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Quote */}
        <blockquote className="text-gray-700 italic leading-relaxed">
          "{quote}"
        </blockquote>

        {/* Author info */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-brand-charcoal">{name}</p>
              <p className="text-sm text-gray-600">
                {role} at {gymName}
              </p>
            </div>
            {/* Google logo */}
            <div className="text-gray-400">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
