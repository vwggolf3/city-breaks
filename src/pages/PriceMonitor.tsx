import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Database, Calendar, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PriceMonitor() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<{
    totalPrices: number;
    destinations: number;
    lastUpdate: string | null;
    weekendTypes: { weekend_type: string; count: number }[];
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [priceCount, destCount, latestUpdate, weekendStats] = await Promise.all([
        supabase.from("ams_flight_prices").select("*", { count: "exact", head: true }),
        supabase.from("ams_destinations").select("*", { count: "exact", head: true }),
        supabase
          .from("ams_flight_prices")
          .select("last_updated_at")
          .order("last_updated_at", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("ams_flight_prices")
          .select("weekend_type")
          .then((result) => {
            if (result.data) {
              const counts = result.data.reduce((acc, row) => {
                acc[row.weekend_type] = (acc[row.weekend_type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              return Object.entries(counts).map(([weekend_type, count]) => ({
                weekend_type,
                count,
              }));
            }
            return [];
          }),
      ]);

      setStats({
        totalPrices: priceCount.count || 0,
        destinations: destCount.count || 0,
        lastUpdate: latestUpdate.data?.last_updated_at || null,
        weekendTypes: weekendStats,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast({
        title: "Error",
        description: "Failed to load statistics",
        variant: "destructive",
      });
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("refresh-ams-prices", {
        body: { batchSize: 20, offsetDestinations: 0 },
      });

      if (error) throw error;

      toast({
        title: "Refresh Started",
        description: `Processing batch of destinations. ${data?.message || ""}`,
      });

      setTimeout(fetchStats, 3000);
    } catch (error) {
      console.error("Error refreshing prices:", error);
      toast({
        title: "Error",
        description: "Failed to trigger price refresh",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Price Monitoring Dashboard</h1>
        <p className="text-muted-foreground">
          Track and manage Amsterdam flight price caching
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prices</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPrices || 0}</div>
            <p className="text-xs text-muted-foreground">Cached flight offers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Destinations</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.destinations || 0}</div>
            <p className="text-xs text-muted-foreground">From Amsterdam</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.lastUpdate
                ? new Date(stats.lastUpdate).toLocaleDateString()
                : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.lastUpdate
                ? new Date(stats.lastUpdate).toLocaleTimeString()
                : "No data"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekend Types</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.weekendTypes.length || 0}</div>
            <p className="text-xs text-muted-foreground">Different combinations</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Manual Price Refresh</CardTitle>
          <CardDescription>
            Trigger a manual refresh of flight prices. This will fetch the latest prices for
            a batch of destinations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="w-full md:w-auto"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Prices
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Prices are automatically refreshed daily at 3 AM UTC. Manual refresh processes
            the first batch of 20 destinations.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekend Type Distribution</CardTitle>
          <CardDescription>
            Breakdown of cached prices by weekend type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {stats?.weekendTypes.map((type) => (
              <Badge key={type.weekend_type} variant="secondary">
                {type.weekend_type}: {type.count} prices
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
