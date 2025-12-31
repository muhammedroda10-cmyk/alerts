import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { AppSettings } from "@/hooks/use-app-settings";
import { toast } from "@/hooks/use-toast";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSettings: AppSettings;
  onSave: (settings: Partial<AppSettings>) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  currentSettings,
  onSave,
}: SettingsDialogProps) {
  const [formData, setFormData] = useState(currentSettings);

  // Reset form when dialog opens with fresh settings
  useEffect(() => {
    if (open) {
      setFormData(currentSettings);
    }
  }, [open, currentSettings]);

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
    toast({ title: "تم الحفظ", description: "تم تحديث الإعدادات بنجاح" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>الإعدادات</DialogTitle>
          <DialogDescription>
            تعديل مفاتيح الربط (API) وإعدادات الذكاء الاصطناعي.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiUrl">رابط API</Label>
            <Input
              id="apiUrl"
              value={formData.apiUrl}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, apiUrl: e.target.value }))
              }
              className="text-left ltr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiToken">Bearer Token</Label>
            <Input
              id="apiToken"
              type="password"
              value={formData.apiToken}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, apiToken: e.target.value }))
              }
              className="text-left ltr"
              placeholder="eyJhbGciOi..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="geminiKey">Gemini API Key</Label>
            <Input
              id="geminiKey"
              type="password"
              value={formData.geminiKey}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, geminiKey: e.target.value }))
              }
              className="text-left ltr"
            />
            <p className="text-[10px] text-muted-foreground">
              يتم الحفظ محلياً في المتصفح.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="geminiModel">Gemini Model</Label>
            <Input
              id="geminiModel"
              value={formData.geminiModel}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, geminiModel: e.target.value }))
              }
              className="text-left ltr"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="combinePnrs"
              checked={formData.combinePnrs}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, combinePnrs: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Label htmlFor="combinePnrs" className="cursor-pointer">
              تجميع PNRs لنفس المشتري
            </Label>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave}>حفظ التغييرات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
