import os
import math

class Coordinate:
    def __init__(self, longitude: str, latitude: str):
        self.longitude: str = longitude
        self.latitude: str = latitude

    def __lt__(self, other):
        if type(other) != type(self):
            return False
        return self.longitude < other.longitude if self.longitude != other.longitude else self.latitude < other.latitude

    def __eq__(self, other):
        if type(other) != type(self):
            return False
        return round(float(self.longitude), 6) == round(float(other.longitude), 6) and round(float(self.latitude), 6) == round(float(other.latitude), 6)

    def __hash__(self):
        return hash((self.longitude, self.latitude))

    def __str__(self):
        return "%s %s" % (self.longitude, self.latitude)

    def __repr__(self):
        return "<lon: %s, lat: %s>" % (self.longitude, self.latitude)

    def to_dict(self):
        return {
            'longitude': float(self.longitude),
            'latitude': float(self.latitude)
        }

def lcs(a, b):
    # generate matrix of length of longest common subsequence for substrings of both words
    len_a, len_b = len(a), len(b)
    lengths = [[0] * (len_b+1) for _ in range(len_a+1)]
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            if x == y:
                lengths[i+1][j+1] = lengths[i][j] + 1
            else:
                lengths[i+1][j+1] = max(lengths[i+1][j], lengths[i][j+1])

    # read a substring from the matrix
    # for i in range(0, len_a + 1):
    #     for j in range(0, len_b +1):
    #         print('%s ' % lengths[i][j], end='')
    #     print()
    
    # read a substring from the matrix
    result = []
    index_a = []
    index_b = []
    i, j = len_a, len_b
    while i > 0 and j > 0:
        if lengths[i][j] == lengths[i][j-1]:
            j -= 1
        elif lengths[i][j] == lengths[i-1][j]:
            i -= 1
        else:
            result.append(a[i-1])
            index_a.append(i-1)
            index_b.append(j-1)
            i -= 1
            j -= 1

    return list(reversed(result)), list(reversed(index_a)), list(reversed(index_b))

if __name__ == '__main__':
    print('start')
    mmdg_folder = '/home/monday/documents/mmd-generator/backend/scripts/simple/'
    ieee_folder = '/home/monday/documents/mmd-generator/backend/scripts/osm/'
    total_hit_count = 0
    total_hit_strip_count = 0
    total_count = 0
    hit_rate_list = []
    for root, _, files in os.walk(mmdg_folder):
        print(files)
        files.sort()
        for dir in files:
            dir_id = dir.split('.')[0].split('-')[1]
            dir_ieee_path = os.path.join(ieee_folder, '%s.out.txt' % dir_id)
            if not os.path.exists(dir_ieee_path):
                print('%s not exists' % dir_id)
                continue
            mmdg_list = []
            with open(os.path.join(root, dir), 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        mmdg_list.append(Coordinate(line.split(' ')[0], line.split(' ')[1]))
                f.close()
            ieee_list = []
            with open(dir_ieee_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        ieee_list.append(Coordinate(line.split(' ')[0], line.split(' ')[1]))
                f.close()
            _, mmdg_index, ieee_index =  lcs(mmdg_list, ieee_list)
            # print('dir %s:\n%s\n%s' % (dir, mmdg_index, ieee_index))

            if len(ieee_index) > 0:
                total_hit_count += len(ieee_index)
                total_hit_strip_count += (len(ieee_index) + ieee_index[0] + len(ieee_list) - 1 -  ieee_index[len(ieee_index) - 1])
                total_count += len(ieee_list)

            hit_rate = len(ieee_index) / len(ieee_list)
            hit_rate_strip = (len(ieee_index) + ieee_index[0] + len(ieee_list) - 1 -  ieee_index[len(ieee_index) - 1]) / len(ieee_list) if len(ieee_index) > 0 else 0
            # if hit_rate < 0.9:
            #     print('ERROR: %s: %s, %s' % (dir_id, hit_rate, hit_rate_strip))
            # else:
            print('%s: %s' % (dir_id, hit_rate))
            # hit_rate_list.append(hit_rate)
    print(hit_rate_list)
    print('total hit rate: %s' % str(total_hit_count / total_count))
    print('total hit rate strip: %s' % str(total_hit_strip_count / total_count))

                


