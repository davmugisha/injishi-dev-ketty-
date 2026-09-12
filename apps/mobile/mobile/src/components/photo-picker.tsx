/**
 * PhotoPicker — tiles first, camera or library behind them.
 *
 * Motivated by frames W6 ("Two photo tiles FIRST: Photo 1 taken, and Add photo
 * · It leads the ticket") and R20 ("PHOTOS: two thumbnails and a camera tile").
 * Both put the picture before the form, and W6 says why in its own note: the
 * ticket is filed while walking, and a photograph is faster and more accurate
 * than a sentence typed one-handed in a corridor.
 *
 * **The permission-denied state is a real state, not an alert.** A denied
 * camera is not an error and must not read as one: it is a setting, it is
 * recoverable, and the person still has a job to finish. So the tile turns into
 * an explanation with the two ways out — open Settings, or use the other source
 * — and the rest of the form stays usable. An `Alert.alert` here would be a
 * dead end with an OK button.
 *
 * Permissions are requested on TAP, never on mount. Asking for the camera the
 * moment a screen renders is how an app trains people to say no.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { Button } from './button';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

export interface PickedPhoto {
  /** A local `file://` uri. Nothing is uploaded in the prototype. */
  uri: string;
  width: number;
  height: number;
}

export interface PhotoPickerProps {
  value: readonly PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  max?: number;
  /** The line under the empty tile. W6's "It leads the ticket". */
  hint?: string;
}

type Denied = 'camera' | 'library' | null;

export function PhotoPicker({ value, onChange, max = 4, hint }: PhotoPickerProps) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const [denied, setDenied] = useState<Denied>(null);
  const [busy, setBusy] = useState(false);

  const add = (asset: ImagePicker.ImagePickerAsset) => {
    onChange([...value, { uri: asset.uri, width: asset.width, height: asset.height }]);
  };

  const shoot = async () => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setDenied('camera');
        return;
      }
      setDenied(null);
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!result.canceled && result.assets[0]) add(result.assets[0]);
    } catch {
      // A picker that fails to open is not worth taking the form down for; the
      // other source is still there and the tiles are still usable.
      setDenied('camera');
    } finally {
      setBusy(false);
    }
  };

  const choose = async () => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setDenied('library');
        return;
      }
      setDenied(null);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) add(result.assets[0]);
    } catch {
      setDenied('library');
    } finally {
      setBusy(false);
    }
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  const tile = {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden' as const,
  };

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        {value.map((photo, i) => (
          <View key={photo.uri} style={[tile, { backgroundColor: c.surface2 }]}>
            <Image
              source={{ uri: photo.uri }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
              accessible
              accessibilityLabel={t('picker.photoIndex', { index: i + 1 })}
            />
            <View style={{ position: 'absolute', top: 4, right: 4 }}>
              <PressableScale
                accessibilityLabel={t('a11y.removePhoto', { index: i + 1 })}
                onPress={() => remove(i)}
                hitSlop={8}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.surfaceInverse,
                }}
              >
                <Icon name="x" size={14} color={c.surface1} />
              </PressableScale>
            </View>
          </View>
        ))}

        {value.length < max ? (
          <PressableScale
            accessibilityLabel={t('picker.addPhoto')}
            accessibilityHint={hint}
            disabled={busy}
            onPress={shoot}
            style={[
              tile,
              {
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: space[2],
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: c.borderStrong,
              },
            ]}
          >
            <Icon name="camera" size={22} color={c.textMuted} />
            <Text size="xs" color="textMuted" center>
              {t('picker.addPhoto')}
            </Text>
            {hint ? (
              <Text size="2xs" color="textSubtle" center>
                {hint}
              </Text>
            ) : null}
          </PressableScale>
        ) : null}

        {/* Keeps the row's rhythm when there is one tile and one slot: without
            it a single tile stretches to the full width. */}
        {value.length + 1 < max ? <View style={{ flex: 1 }} /> : null}
      </View>

      {denied ? (
        <View
          accessible
          accessibilityRole="alert"
          style={{
            gap: space[2],
            padding: space[4],
            borderRadius: radius.lg,
            backgroundColor: c.warning100,
            borderWidth: 1,
            borderColor: c.warning500,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="alertTriangle" size={16} color={c.warning600} />
            <Text weight="semibold" size="sm" color="textStrong">
              {t(denied === 'camera' ? 'picker.cameraDeniedTitle' : 'picker.libraryDeniedTitle')}
            </Text>
          </View>
          <Text size="sm" color="textBody" style={{ lineHeight: 19 }}>
            {t(denied === 'camera' ? 'picker.cameraDeniedBody' : 'picker.libraryDeniedBody')}
          </Text>
          <View style={{ flexDirection: 'row', gap: space[2], marginTop: 2 }}>
            <Button variant="outline" size="sm" onPress={() => void Linking.openSettings()}>
              {t('picker.openSettings')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => void (denied === 'camera' ? choose() : shoot())}
            >
              {t(denied === 'camera' ? 'picker.library' : 'picker.camera')}
            </Button>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button variant="outline" size="sm" leadingIcon="camera" disabled={busy} onPress={() => void shoot()}>
            {t('picker.camera')}
          </Button>
          <Button variant="ghost" size="sm" leadingIcon="image" disabled={busy} onPress={() => void choose()}>
            {t('picker.library')}
          </Button>
        </View>
      )}
    </View>
  );
}
