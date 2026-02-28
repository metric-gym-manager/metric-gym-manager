import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

export function FeatureCard({ icon, title, description, badge }: FeatureCardProps) {
  return (
    <Card className="relative hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-gray-200">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          {/* Icon with brand color background */}
          <div className="flex justify-center">
            <div className="p-4 bg-brand-accent/10 rounded-full text-brand-accent">
              {icon}
            </div>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-lg text-brand-charcoal">
            {title}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed">
            {description}
          </p>

          {/* Optional badge (e.g., "Coming Soon") */}
          {badge && (
            <div className="pt-2">
              <Badge className="bg-brand-accent hover:bg-brand-accent/90 text-white">
                {badge}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
